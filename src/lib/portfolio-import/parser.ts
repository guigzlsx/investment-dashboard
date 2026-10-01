import type { ImportFileFormat, ParsedImportSheet } from "./types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function parseCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { values.push(current.trim()); current = ""; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

function detectDelimiter(line: string) {
  const candidates = [",", ";", "\t"];
  return candidates.sort((left, right) => parseCsvLine(line, right).length - parseCsvLine(line, left).length)[0];
}

function decodeCsv(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer).replace(/^\uFEFF/, "");
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer).replace(/^\uFEFF/, "");
}

function parseCsv(buffer: Buffer): ParsedImportSheet[] {
  const lines = decodeCsv(buffer).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim());
  if (!lines.length) throw new Error("empty_file");
  const delimiter = detectDelimiter(lines[0]);
  const columns = parseCsvLine(lines[0], delimiter).map((column, index) => column || `Column ${index + 1}`);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line, delimiter);
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? ""]));
  });
  return [{ name: "CSV", columns, rows }];
}

async function parseXlsx(buffer: Buffer): Promise<ParsedImportSheet[]> {
  const exceljsModule = await import("exceljs");
  const ExcelJS = exceljsModule.default ?? exceljsModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.worksheets.map((worksheet) => {
    const matrix: unknown[][] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const value = cell.value;
        // Formula cells are deliberately ignored: the importer never executes spreadsheet formulas.
        cells[columnNumber - 1] = value && typeof value === "object" && "formula" in value ? "" : value ?? "";
      });
      matrix.push(cells);
    });
    const header = (matrix[0] ?? []).map((value, index) => String(value ?? `Column ${index + 1}`).trim() || `Column ${index + 1}`);
    const rows = matrix.slice(1).map((cells) => Object.fromEntries(header.map((column, index) => [column, cells[index] ?? ""]))).filter((row) => Object.values(row).some((value) => String(value).trim()));
    return { name: worksheet.name, columns: header, rows };
  }).filter((sheet) => sheet.columns.length > 0);
}

export async function parseImportFile(fileName: string, buffer: Buffer): Promise<{ format: ImportFileFormat; sheets: ParsedImportSheet[] }> {
  if (buffer.length > MAX_FILE_BYTES) throw new Error("file_too_large");
  const lowerName = fileName.toLowerCase();
  try {
    if (lowerName.endsWith(".csv")) return { format: "CSV", sheets: parseCsv(buffer) };
    if (lowerName.endsWith(".xlsx")) return { format: "XLSX", sheets: await parseXlsx(buffer) };
  } catch (error) {
    if (error instanceof Error && error.message === "empty_file") throw error;
    throw new Error("malformed_file");
  }
  throw new Error("unsupported_file_type");
}

export { MAX_FILE_BYTES };

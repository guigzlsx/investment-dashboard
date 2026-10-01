import { describe, expect, it } from "vitest";
import { parseImportFile } from "./parser";

describe("portfolio import parsers", () => {
  it("parses French semicolon CSV with comma decimals", async () => {
    const result = await parseImportFile("revolut.csv", Buffer.from("Date;Type;Instrument;Qté;Prix;Devise\n2026-01-15;Achat;NVIDIA;0,25;180,50;USD\n"));
    expect(result.format).toBe("CSV");
    expect(result.sheets[0].rows[0]).toMatchObject({ Instrument: "NVIDIA", "Qté": "0,25", Prix: "180,50" });
  });

  it("reads the first row as headers and supports multiple XLSX sheets", async () => {
    const ExcelJSModule = await import("exceljs");
    const ExcelJS = ExcelJSModule.default ?? ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    const trades = workbook.addWorksheet("Trades");
    trades.addRow(["Date", "Type", "Ticker"]); trades.addRow(["2026-01-15", "BUY", "NVDA"]);
    const other = workbook.addWorksheet("Other");
    other.addRow(["Ignored"]); other.addRow(["x"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parseImportFile("portfolio.xlsx", buffer);
    expect(result.format).toBe("XLSX");
    expect(result.sheets.map((sheet) => sheet.name)).toEqual(["Trades", "Other"]);
    expect(result.sheets[0].rows[0]).toMatchObject({ Date: "2026-01-15", Type: "BUY", Ticker: "NVDA" });
  });

  it("rejects unsupported and empty files", async () => {
    await expect(parseImportFile("statement.pdf", Buffer.from("not a spreadsheet"))).rejects.toThrow("unsupported_file_type");
    await expect(parseImportFile("empty.csv", Buffer.from(""))).rejects.toThrow("empty_file");
  });
});

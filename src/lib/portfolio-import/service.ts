import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getDefaultPortfolio, listTransactions } from "../supabase/repositories";
import type { Database, Json } from "../supabase/database.types";
import { parseImportFile } from "./parser";
import { detectColumnMapping } from "./column-detector";
import { normalizeImportRows } from "./normalizer";
import { AssetResolver } from "./asset-resolver";
import { markImportDuplicates, summarizeImportRows } from "./validator";
import type { ImportColumnMapping, ImportFileFormat, ImportSessionState, NormalizedImportedTransaction, PortfolioImportPreview } from "./types";

type ImportSupabase = SupabaseClient<Database>;

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "portfolio-import";
}

function statusFor(row: NormalizedImportedTransaction) {
  if (row.status === "UNSUPPORTED") return "UNSUPPORTED";
  if (row.errors.length) return "ERROR";
  if (row.possibleDuplicate) return "DUPLICATE";
  if (row.warnings.length) return "WARNING";
  return "READY";
}

function validateMapping(mapping: ImportColumnMapping) {
  const fields = Object.values(mapping).filter((field) => field !== "ignore");
  if (new Set(fields).size !== fields.length) throw new Error("duplicate_mapping");
}

function addResolution(row: NormalizedImportedTransaction, resolution: NormalizedImportedTransaction["assetResolution"]) {
  row.assetResolution = resolution;
  if (!resolution) return;
  if (resolution.requiresReview) {
    row.errors = [...row.errors.filter((error) => !error.startsWith("Asset")), "Asset needs your confirmation"];
    row.status = "ERROR";
    return;
  }
  row.assetId = resolution.assetId;
  row.symbol = resolution.symbol;
  row.name = resolution.name;
  row.isin = resolution.isin;
  row.exchange = resolution.exchange;
  row.confidence = resolution.confidence;
  row.errors = row.errors.filter((error) => !error.startsWith("Asset"));
  row.status = statusFor(row);
}

function selectionKey(row: NormalizedImportedTransaction, selection: string) {
  return row.assetResolution?.candidates.find((candidate) => candidate.id === selection || `${candidate.symbol}|${candidate.exchange ?? ""}` === selection);
}

function applySelection(row: NormalizedImportedTransaction, selection?: string) {
  if (!selection || !row.assetResolution) return;
  const chosen = selectionKey(row, selection);
  if (!chosen) return;
  row.assetResolution = { ...row.assetResolution, symbol: chosen.symbol, name: chosen.name, isin: chosen.isin ?? null, exchange: chosen.exchange ?? null, assetId: chosen.id ?? null, candidates: [chosen], confidence: "HIGH", requiresReview: false, reason: "EXISTING_ASSET" };
  row.assetId = chosen.id ?? null;
  row.symbol = chosen.symbol;
  row.name = chosen.name;
  row.isin = chosen.isin ?? row.isin;
  row.exchange = chosen.exchange ?? row.exchange;
  row.errors = row.errors.filter((error) => !error.startsWith("Asset"));
  row.status = statusFor(row);
}

async function saveSession(supabase: ImportSupabase, user: User, portfolioId: string, options: { importId?: string; fileName: string; format: ImportFileFormat; selectedSheet: string | null; columns: string[]; mapping: ImportColumnMapping; rows: NormalizedImportedTransaction[]; sheetNames: string[] }) {
  const summary = summarizeImportRows(options.rows);
  const state: ImportSessionState = summary.ready > 0 ? "READY" : "FAILED";
  let importId = options.importId;
  if (importId) {
    const existing = await supabase.from("portfolio_imports").select("id").eq("id", importId).eq("user_id", user.id).eq("portfolio_id", portfolioId).maybeSingle();
    if (!existing.data || existing.error) importId = undefined;
  }
  if (!importId) {
    const created = await supabase.from("portfolio_imports").insert({ user_id: user.id, portfolio_id: portfolioId, file_name: safeFileName(options.fileName), source_format: options.format, selected_sheet: options.selectedSheet, state, row_count: summary.total, ready_count: summary.ready, warning_count: summary.warnings, error_count: summary.errors, duplicate_count: summary.duplicates }).select("id").single();
    if (created.error) throw created.error;
    importId = created.data.id;
  } else {
    const cleared = await supabase.from("portfolio_import_rows").delete().eq("import_id", importId).eq("user_id", user.id);
    if (cleared.error) throw cleared.error;
    const updated = await supabase.from("portfolio_imports").update({ file_name: safeFileName(options.fileName), source_format: options.format, selected_sheet: options.selectedSheet, state, row_count: summary.total, ready_count: summary.ready, warning_count: summary.warnings, error_count: summary.errors, duplicate_count: summary.duplicates, imported_count: 0 }).eq("id", importId).eq("user_id", user.id);
    if (updated.error) throw updated.error;
  }

  const records = options.rows.map((row) => ({ import_id: importId as string, user_id: user.id, source_row: row.sourceRow, status: row.status, normalized_data: row as unknown as Json }));
  for (let index = 0; index < records.length; index += 500) {
    const inserted = await supabase.from("portfolio_import_rows").insert(records.slice(index, index + 500));
    if (inserted.error) throw inserted.error;
  }
  return { importId: importId as string, state, summary };
}

export async function buildPortfolioImportPreview(supabase: ImportSupabase, user: User, input: { fileName: string; buffer: Buffer; importId?: string; sheetName?: string; mapping?: ImportColumnMapping; selections?: Record<string, string> }): Promise<PortfolioImportPreview> {
  const portfolio = await getDefaultPortfolio(supabase, user.id);
  const parsed = await parseImportFile(input.fileName, input.buffer);
  const selected = parsed.sheets.find((sheet) => sheet.name === input.sheetName) ?? parsed.sheets.find((sheet) => sheet.rows.length > 0) ?? parsed.sheets[0];
  if (!selected || selected.rows.length === 0) throw new Error("empty_file");
  const mapping = input.mapping ?? detectColumnMapping(selected.columns);
  validateMapping(mapping);
  const rows = normalizeImportRows(selected.rows, mapping);
  const baseCurrency = String(portfolio.base_currency).toUpperCase();
  for (const row of rows) {
    if (row.currency && row.currency === baseCurrency) row.fxRateToBase = 1;
    else if (row.currency && row.fxRateToBase === null) row.errors.push(`FX rate to ${baseCurrency} is required for this transaction`);
    if (row.errors.length && row.status !== "UNSUPPORTED") row.status = "ERROR";
  }
  const resolver = new AssetResolver(supabase);
  for (const row of rows) {
    if (row.errors.length || !row.assetIdentifier) continue;
    addResolution(row, await resolver.resolve(row));
    applySelection(row, input.selections?.[String(row.sourceRow)]);
  }
  const existing = await listTransactions(supabase, portfolio.id);
  markImportDuplicates(rows, existing);
  for (const row of rows) row.status = statusFor(row);
  const saved = await saveSession(supabase, user, portfolio.id, { importId: input.importId, fileName: input.fileName, format: parsed.format, selectedSheet: selected.name, columns: selected.columns, mapping, rows, sheetNames: parsed.sheets.map((sheet) => sheet.name) });
  return { importId: saved.importId, fileName: safeFileName(input.fileName), format: parsed.format, state: saved.state, sheetNames: parsed.sheets.map((sheet) => sheet.name), selectedSheet: selected.name, columns: selected.columns, mapping, rows, summary: saved.summary };
}

export function importErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "file_too_large") return "This file is too large. Please use a file smaller than 10 MB.";
  if (code === "unsupported_file_type") return "This file type is not supported. Please choose a CSV or XLSX file.";
  if (code === "empty_file") return "This file doesn't appear to contain portfolio transactions.";
  if (code === "malformed_file") return "We couldn't read this spreadsheet. Please export it again as CSV or XLSX.";
  if (code === "duplicate_mapping") return "Each destination field can only be mapped once.";
  if (code.includes("Quantity")) return "We couldn't identify the Quantity column.";
  return "We couldn't read this portfolio file. Check the file format and try again.";
}

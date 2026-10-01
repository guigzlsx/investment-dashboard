import type { ImportColumnField, ImportColumnMapping } from "./types";
import type { TransactionType } from "../portfolio/types";

export type PresetTransactionMapping = TransactionType | "IGNORE";

export interface ImportPreset {
  id: string;
  label: string;
  columnMappings: Partial<Record<Exclude<ImportColumnField, "ignore">, string>>;
  transactionTypeMappings: Record<string, PresetTransactionMapping>;
  cashOperationValues: string[];
  matches(columns: string[]): boolean;
}

export function normalizePresetText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—_/-]+/g, " ")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasHeaders(columns: string[], expected: string[]) {
  const normalized = new Set(columns.map(normalizePresetText));
  return expected.every((header) => normalized.has(normalizePresetText(header)));
}

export const revolutBrokeragePreset: ImportPreset = {
  id: "revolut-brokerage",
  label: "Revolut Brokerage",
  columnMappings: {
    date: "Date",
    ticker: "Ticker",
    transactionType: "Type",
    quantity: "Quantity",
    price: "Price per share",
    currency: "Currency",
    fxRateToBase: "FX Rate",
  },
  transactionTypeMappings: {
    "BUY MARKET": "BUY",
    "SELL MARKET": "SELL",
  },
  cashOperationValues: ["CASH TOP UP", "CASH WITHDRAWAL", "CASH DEPOSIT", "CASH TRANSFER"],
  matches(columns) {
    return hasHeaders(columns, ["Date", "Ticker", "Type", "Quantity", "Price per share", "Total Amount", "Currency", "FX Rate"]);
  },
};

const presets: ImportPreset[] = [revolutBrokeragePreset];

export function detectImportPreset(columns: string[]) {
  return presets.find((preset) => preset.matches(columns)) ?? null;
}

export function applyPresetColumnMappings(columns: string[], mapping: ImportColumnMapping, preset: ImportPreset | null) {
  if (!preset) return mapping;
  const next = { ...mapping };
  const used = new Set(Object.values(next).filter((field) => field !== "ignore"));
  for (const [field, header] of Object.entries(preset.columnMappings) as Array<[Exclude<ImportColumnField, "ignore">, string]>) {
    const column = columns.find((candidate) => normalizePresetText(candidate) === normalizePresetText(header));
    if (column && (!used.has(field) || next[column] === "ignore")) {
      next[column] = field;
      used.add(field);
    }
  }
  return next;
}

export function isPresetCashOperation(value: unknown, preset: ImportPreset | null) {
  const normalized = normalizePresetText(value);
  if (preset?.cashOperationValues.includes(normalized)) return true;
  return ["CASH TOP UP", "CASH WITHDRAWAL", "CASH DEPOSIT", "CASH TRANSFER"].includes(normalized);
}

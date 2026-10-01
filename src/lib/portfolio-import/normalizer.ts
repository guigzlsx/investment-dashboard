import type { Currency, TransactionType } from "../portfolio/types";
import { parseImportDate } from "./date";
import { parseImportNumber } from "./number";
import type { ImportColumnField, ImportColumnMapping, NormalizedImportedTransaction } from "./types";

const currencies = new Set<Currency>(["EUR", "USD", "GBP", "CHF"]);
const unsupportedTypes = new Set(["DIVIDEND", "INTEREST", "TRANSFER", "SPLIT", "FEE", "CASH", "DEPOSIT", "WITHDRAWAL"]);

function mappedValue(row: Record<string, unknown>, mapping: ImportColumnMapping, field: ImportColumnField) {
  const column = Object.entries(mapping).find(([, value]) => value === field)?.[0];
  return column ? row[column] : undefined;
}

function textValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function transactionType(value: unknown): { value: TransactionType | null; unsupported: string | null } {
  const normalized = textValue(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["BUY", "PURCHASE", "ACHAT", "BUY ORDER"].includes(normalized)) return { value: "BUY", unsupported: null };
  if (["SELL", "SALE", "VENTE", "SELL ORDER"].includes(normalized)) return { value: "SELL", unsupported: null };
  if (unsupportedTypes.has(normalized)) return { value: normalized as TransactionType, unsupported: `Transaction type ${normalized} is not supported yet` };
  return { value: null, unsupported: null };
}

function confidenceFor(identifier: string, hasIsin: boolean) {
  if (hasIsin) return "HIGH" as const;
  if (/^[A-Z0-9.\-]{1,15}$/.test(identifier)) return "MEDIUM" as const;
  return "LOW" as const;
}

export function normalizeImportRows(rows: Array<Record<string, unknown>>, mapping: ImportColumnMapping): NormalizedImportedTransaction[] {
  return rows.map((row, index) => {
    const ticker = textValue(mappedValue(row, mapping, "ticker")).toUpperCase() || null;
    const isin = textValue(mappedValue(row, mapping, "isin")).toUpperCase() || null;
    const name = textValue(mappedValue(row, mapping, "name")) || null;
    const exchange = textValue(mappedValue(row, mapping, "exchange")).toUpperCase() || null;
    const assetIdentifier = isin ?? ticker ?? name ?? "";
    const type = transactionType(mappedValue(row, mapping, "transactionType"));
    const quantity = parseImportNumber(mappedValue(row, mapping, "quantity"));
    const price = parseImportNumber(mappedValue(row, mapping, "price"));
    const fees = parseImportNumber(mappedValue(row, mapping, "fees"));
    const fxRate = parseImportNumber(mappedValue(row, mapping, "fxRateToBase"));
    const rawCurrency = textValue(mappedValue(row, mapping, "currency")).toUpperCase();
    const currency = currencies.has(rawCurrency as Currency) ? rawCurrency as Currency : null;
    const date = parseImportDate(mappedValue(row, mapping, "date"));
    const warnings: string[] = [];
    const errors: string[] = [];
    if (!assetIdentifier) errors.push("Asset identifier is missing");
    if (!type.value) errors.push(type.unsupported ?? "Transaction type is missing or unknown");
    if (type.unsupported) errors.push(type.unsupported);
    if (quantity.value === null || quantity.value <= 0) errors.push("Quantity is invalid");
    if (quantity.ambiguous) warnings.push("Quantity format may be ambiguous; please review");
    if (price.value === null || price.value < 0) errors.push("Price is invalid");
    if (price.ambiguous) warnings.push("Price format may be ambiguous; please review");
    if (!currency) errors.push("Currency is missing or unsupported");
    if (fees.value !== null && fees.value < 0) errors.push("Fees cannot be negative");
    if (fxRate.value !== null && fxRate.value <= 0) errors.push("FX rate must be positive");
    if (date.ambiguous) errors.push("Date is ambiguous; use YYYY-MM-DD or confirm the date");
    else if (!date.value) errors.push("Date is invalid or missing");
    if (fees.ambiguous) warnings.push("Fees format may be ambiguous; please review");
    if (fxRate.ambiguous) warnings.push("FX rate format may be ambiguous; please review");
    const status = type.unsupported ? "UNSUPPORTED" : errors.length ? "ERROR" : warnings.length ? "WARNING" : "READY";
    return {
      sourceRow: index + 2,
      assetIdentifier,
      symbol: ticker,
      name,
      isin,
      exchange,
      assetId: null,
      assetType: null,
      transactionType: type.value,
      quantity: quantity.value,
      price: price.value,
      currency,
      fees: fees.value ?? 0,
      transactionDate: date.value,
      fxRateToBase: fxRate.value,
      confidence: confidenceFor(assetIdentifier, Boolean(isin)),
      warnings,
      errors,
      status,
      possibleDuplicate: false,
      assetResolution: null,
    };
  });
}

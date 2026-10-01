import type { Currency, TransactionType } from "../portfolio/types";
import { parseImportDate } from "./date";
import { parseImportMoney, parseImportNumber } from "./number";
import { isPresetCashOperation, normalizePresetText, type ImportPreset } from "./presets";
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

function transactionType(value: unknown, preset: ImportPreset | null): { value: TransactionType | null; unsupported: string | null; ignored: boolean } {
  const raw = textValue(value);
  const normalized = normalizePresetText(raw);
  if (isPresetCashOperation(raw, preset)) return { value: null, unsupported: null, ignored: true };
  const presetMapping = preset?.transactionTypeMappings[normalized];
  if (presetMapping === "BUY" || presetMapping === "SELL") return { value: presetMapping, unsupported: null, ignored: false };
  if (["BUY", "PURCHASE", "ACHAT", "BUY ORDER", "BUY MARKET"].includes(normalized)) return { value: "BUY", unsupported: null, ignored: false };
  if (["SELL", "SALE", "VENTE", "SELL ORDER", "SELL MARKET"].includes(normalized)) return { value: "SELL", unsupported: null, ignored: false };
  if (unsupportedTypes.has(normalized)) return { value: normalized as TransactionType, unsupported: `Transaction type ${normalized} is not supported yet`, ignored: false };
  return { value: null, unsupported: null, ignored: false };
}

function confidenceFor(identifier: string, hasIsin: boolean) {
  if (hasIsin) return "HIGH" as const;
  if (/^[A-Z0-9.\-]{1,15}$/.test(identifier)) return "MEDIUM" as const;
  return "LOW" as const;
}

export function normalizeImportRows(rows: Array<Record<string, unknown>>, mapping: ImportColumnMapping, options: { preset?: ImportPreset | null } = {}): NormalizedImportedTransaction[] {
  return rows.map((row, index) => {
    const ticker = textValue(mappedValue(row, mapping, "ticker")).toUpperCase() || null;
    const isin = textValue(mappedValue(row, mapping, "isin")).toUpperCase() || null;
    const name = textValue(mappedValue(row, mapping, "name")) || null;
    const exchange = textValue(mappedValue(row, mapping, "exchange")).toUpperCase() || null;
    const assetIdentifier = isin ?? ticker ?? name ?? "";
    const type = transactionType(mappedValue(row, mapping, "transactionType"), options.preset ?? null);
    const quantity = parseImportNumber(mappedValue(row, mapping, "quantity"));
    const price = parseImportMoney(mappedValue(row, mapping, "price"));
    const fees = parseImportNumber(mappedValue(row, mapping, "fees"));
    const fxRate = parseImportNumber(mappedValue(row, mapping, "fxRateToBase"));
    const rawCurrency = textValue(mappedValue(row, mapping, "currency")).toUpperCase();
    const inferredCurrency = price.currency;
    const currency = currencies.has(rawCurrency as Currency) ? rawCurrency as Currency : inferredCurrency;
    const date = parseImportDate(mappedValue(row, mapping, "date"));
    const warnings: string[] = [];
    const errors: string[] = [];
    if (type.ignored) {
      return {
        sourceRow: index + 2,
        assetIdentifier: "",
        symbol: null,
        name: null,
        isin: null,
        exchange: null,
        assetId: null,
        assetType: null,
        transactionType: null,
        quantity: null,
        price: null,
        currency: currency ?? null,
        fees: 0,
        transactionDate: date.value,
        fxRateToBase: fxRate.value,
        confidence: "HIGH",
        warnings: ["Cash operation ignored"],
        errors: [],
        status: "IGNORED",
        possibleDuplicate: false,
        assetResolution: null,
      };
    }
    if (!assetIdentifier) errors.push("Asset identifier is missing");
    if (!type.value) errors.push(type.unsupported ?? "Transaction type is missing or unknown");
    if (type.unsupported) errors.push(type.unsupported);
    if (quantity.value === null || quantity.value <= 0) errors.push("Quantity is invalid");
    if (quantity.ambiguous) warnings.push("Quantity format may be ambiguous; please review");
    if (price.value === null || price.value < 0) errors.push("Price is invalid");
    if (price.ambiguous) warnings.push("Price format may be ambiguous; please review");
    if (!currency) errors.push("Currency is missing or unsupported");
    if (rawCurrency && inferredCurrency && rawCurrency !== inferredCurrency) errors.push(`Price currency ${inferredCurrency} does not match transaction currency ${rawCurrency}`);
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

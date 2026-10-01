import type { Currency } from "../portfolio/types";

export interface ParsedImportMoney {
  value: number | null;
  ambiguous: boolean;
  currency: Currency | null;
}

function currencyPrefix(value: string): Currency | null {
  const match = value.trim().match(/^(EUR|USD|GBP|CHF)\b/i)?.[1]?.toUpperCase();
  return match === "EUR" || match === "USD" || match === "GBP" || match === "CHF" ? match : null;
}

export function parseImportNumber(value: unknown): { value: number | null; ambiguous: boolean } {
  const parsed = parseImportMoney(value);
  return { value: parsed.value, ambiguous: parsed.ambiguous };
}

export function parseImportMoney(value: unknown): ParsedImportMoney {
  if (typeof value === "number") return Number.isFinite(value) ? { value, ambiguous: false, currency: null } : { value: null, ambiguous: false, currency: null };
  if (value === null || value === undefined) return { value: null, ambiguous: false, currency: null };
  let text = String(value).trim();
  const currency = currencyPrefix(text);
  if (!text) return { value: null, ambiguous: false, currency: null };

  const negative = /^\(.*\)$/.test(text) || /^-/.test(text);
  text = text.replace(/[()]/g, "").replace(/[^0-9,.'\-+]/g, "").replace(/'/g, "");
  if (!text || !/[0-9]/.test(text)) return { value: null, ambiguous: false, currency };

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let normalized = text;
  let ambiguous = false;
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = text.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    const integerPart = text.slice(0, comma);
    if (decimals === 3 && comma > 0 && !/^0+$/.test(integerPart)) normalized = text.replace(",", "");
    else normalized = text.replace(",", ".");
  } else if (dot >= 0) {
    const decimals = text.length - dot - 1;
    if (decimals === 3 && dot > 0 && text.length - dot - 1 === 3 && text.indexOf(".") === dot) ambiguous = true;
    normalized = text;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, ambiguous, currency };
  return { value: negative ? -Math.abs(parsed) : parsed, ambiguous, currency };
}

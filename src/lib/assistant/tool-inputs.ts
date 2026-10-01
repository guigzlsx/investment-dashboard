import type { Currency } from "../portfolio/types";
import { InputValidationError, parseFiniteNumber, parseSymbol } from "../validation/inputs";

export function objectInput(value: unknown) {
  if (value === undefined || value === null) return {} as Record<string, unknown>;
  if (typeof value !== "object" || Array.isArray(value)) throw new InputValidationError("Tool input must be an object");
  return value as Record<string, unknown>;
}

export function symbolInput(value: unknown, label = "symbol") {
  if (typeof value !== "string") throw new InputValidationError(`${label} is required`);
  return parseSymbol(value);
}

export function periodInput(value: unknown) {
  const period = typeof value === "string" ? value.toUpperCase() : "1D";
  if (period !== "1D" && period !== "1W" && period !== "1M") throw new InputValidationError("period is invalid");
  return period as "1D" | "1W" | "1M";
}

export function currencyInput(value: unknown) {
  const currency = typeof value === "string" ? value.toUpperCase() : "";
  if (currency !== "EUR" && currency !== "USD" && currency !== "CHF" && currency !== "GBP") throw new InputValidationError("currency is invalid");
  return currency as Currency;
}

export function percentInput(value: unknown, label = "changePercent") {
  const percent = parseFiniteNumber(value, label, { nullable: false });
  if (percent < -100 || percent > 1000) throw new InputValidationError(`${label} is outside the supported range`);
  return percent;
}

export function symbolsInput(value: unknown) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 5) throw new InputValidationError("symbols must contain between 2 and 5 assets");
  return value.map((item) => symbolInput(item, "symbol"));
}

export function queryInput(value: unknown) {
  if (typeof value !== "string") throw new InputValidationError("query is required");
  const query = value.trim();
  if (query.length < 2) throw new InputValidationError("Query must contain at least 2 characters");
  if (query.length > 500) throw new InputValidationError("Query is too long");
  return query;
}

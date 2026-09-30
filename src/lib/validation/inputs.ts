export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export function parseSearchQuery(value: string | null) {
  const query = value?.trim() ?? "";
  if (query.length < 2) throw new InputValidationError("Search query must contain at least 2 characters");
  if (query.length > 64) throw new InputValidationError("Search query is too long");
  return query;
}

export function parseSymbol(value: string) {
  const symbol = decodeURIComponent(value).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.:-]{0,15}$/.test(symbol)) throw new InputValidationError("Invalid asset symbol");
  return symbol;
}

export function parseUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new InputValidationError(`${label} must be a UUID`);
  }
  return value;
}

export function parseFiniteNumber(value: unknown, label: string, options: { min?: number; nullable: true }): number | null;
export function parseFiniteNumber(value: unknown, label: string, options?: { min?: number; nullable?: false }): number;
export function parseFiniteNumber(value: unknown, label: string, options: { min?: number; nullable?: boolean } = {}): number | null {
  if (value === null || value === undefined || value === "") {
    if (options.nullable) return null;
    throw new InputValidationError(`${label} is required`);
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || (options.min !== undefined && number < options.min)) throw new InputValidationError(`${label} is invalid`);
  return number;
}

export type MarketDataErrorCode =
  | "CONFIGURATION"
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "PLAN_REQUIRED"
  | "UNSUPPORTED_SYMBOL"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "UPSTREAM"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE";

export class MarketDataProviderError extends Error {
  constructor(
    message: string,
    public readonly code: MarketDataErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "MarketDataProviderError";
  }
}

export type MarketDataErrorCode = "CONFIGURATION" | "AUTHENTICATION" | "RATE_LIMIT" | "NOT_FOUND" | "UPSTREAM" | "INVALID_RESPONSE";

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

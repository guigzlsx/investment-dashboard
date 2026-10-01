export type Currency = "EUR" | "USD" | "CHF" | "GBP";

export type TransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "SPLIT"
  | "DEPOSIT"
  | "WITHDRAWAL";

export type AssetType = "STOCK" | "ETF";

export interface PortfolioTransaction {
  id: string;
  portfolioId?: string;
  assetId?: string;
  symbol: string;
  providerSymbol?: string;
  providerSymbols?: Record<string, unknown>;
  exchange?: string;
  name?: string;
  assetType?: AssetType;
  assetCurrency?: Currency;
  sector?: string;
  country?: string;
  themes?: string[];
  type: TransactionType;
  quantity: number | null;
  unitPrice: number | null;
  currency: Currency;
  fees: number;
  quoteCurrency?: Currency;
  fxRateToBase?: number;
  fxRateDate?: string;
  fxSource?: string;
  executedAt: string;
  createdAt?: string;
}

export interface PositionSummary {
  assetId?: string;
  symbol: string;
  providerSymbol?: string;
  providerSymbols?: Record<string, unknown>;
  exchange?: string;
  name?: string;
  assetType?: AssetType;
  assetCurrency?: Currency;
  sector?: string;
  country?: string;
  themes?: string[];
  quantity: number;
  averagePrice: number | null;
  averagePriceCurrency: Currency | null;
  quoteCurrency: Currency | null;
  transactionCurrencies: Currency[];
  costBasis: number;
  realizedPnl: number;
  currentPrice?: number | null;
  currentValue?: number | null;
  unrealizedPnl?: number | null;
  unrealizedPnlPercent?: number | null;
  weight?: number | null;
}

export interface PortfolioSnapshot {
  id?: string;
  portfolioId: string;
  capturedAt: string;
  portfolioValue: number | null;
  investedCapital: number | null;
  unrealizedPnl: number | null;
  cash: number | null;
  currency: Currency;
  dataQuality: "COMPLETE" | "PARTIAL" | "UNKNOWN";
}

export interface PortfolioSummary {
  baseCurrency: Currency;
  investedCost: number | null;
  currentValue: number | null;
  pnl: number | null;
  performance: number | null;
  dailyChange: number | null;
  dataQuality: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  positions: PositionSummary[];
}

export type PositionValuationReason = "VALUED" | "QUOTE_NOT_FOUND" | "PROVIDER_ERROR" | "RATE_LIMIT" | "STALE_CACHE" | "FX_MISSING";

export interface PositionValuationDiagnostic {
  assetId: string | null;
  symbol: string;
  providerSymbol: string;
  assetCurrency: Currency | null;
  quoteCurrency: Currency | null;
  portfolioCurrency: Currency;
  quoteAvailable: boolean;
  quoteSource: string | null;
  quoteTimestamp: string | null;
  quoteAsOfDate: string | null;
  quoteFreshness: "FRESH" | "STALE" | "UNKNOWN" | null;
  fxRequired: boolean;
  fxAvailable: boolean;
  marketValueCalculable: boolean;
  reason: PositionValuationReason;
  providerErrorCode?: string | null;
  message?: string | null;
}

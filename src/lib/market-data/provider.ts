import type { Asset, CompanyProfile, FinancialStatement, HistoricalPrice, KeyMetrics, Quote } from "./models";

export interface HistoricalPriceQuery {
  from?: string;
  to?: string;
  limit?: number;
}

export interface MarketDataProvider {
  searchAssets(query: string): Promise<Asset[]>;
  getQuote(symbol: string): Promise<Quote>;
  getHistoricalPrices(symbol: string, query?: HistoricalPriceQuery): Promise<HistoricalPrice[]>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile>;
  getFinancials(symbol: string): Promise<FinancialStatement[]>;
  getKeyMetrics(symbol: string): Promise<KeyMetrics[]>;
}

import { MARKET_DATA_TTL_MS } from "./cache";
import { FmpMarketDataProvider } from "./fmp";
import { withPersistentMarketCache } from "./persistent-cache";
import type { MarketDataProvider } from "./provider";

class CachedMarketDataProvider implements MarketDataProvider {
  constructor(private readonly provider: MarketDataProvider) {}

  searchAssets(query: string) { return withPersistentMarketCache({ key: `search:${query.trim().toLowerCase()}`, resourceType: "search", ttlMs: MARKET_DATA_TTL_MS.search, loader: () => this.provider.searchAssets(query) }); }
  getQuote(symbol: string) { return withPersistentMarketCache({ key: `quote:${symbol.toUpperCase()}`, resourceType: "quote", ttlMs: MARKET_DATA_TTL_MS.quote, loader: () => this.provider.getQuote(symbol) }); }
  getHistoricalPrices(symbol: string, query?: Parameters<MarketDataProvider["getHistoricalPrices"]>[1]) { return withPersistentMarketCache({ key: `history:${symbol.toUpperCase()}:${JSON.stringify(query ?? {})}`, resourceType: "historical_prices", ttlMs: MARKET_DATA_TTL_MS.historicalPrices, loader: () => this.provider.getHistoricalPrices(symbol, query) }); }
  getCompanyProfile(symbol: string) { return withPersistentMarketCache({ key: `profile:${symbol.toUpperCase()}`, resourceType: "company_profile", ttlMs: MARKET_DATA_TTL_MS.profile, loader: () => this.provider.getCompanyProfile(symbol) }); }
  getFinancials(symbol: string) { return withPersistentMarketCache({ key: `financials:${symbol.toUpperCase()}`, resourceType: "financials", ttlMs: MARKET_DATA_TTL_MS.financials, loader: () => this.provider.getFinancials(symbol) }); }
  getKeyMetrics(symbol: string) { return withPersistentMarketCache({ key: `metrics:${symbol.toUpperCase()}`, resourceType: "key_metrics", ttlMs: MARKET_DATA_TTL_MS.keyMetrics, loader: () => this.provider.getKeyMetrics(symbol) }); }
}

let provider: MarketDataProvider | undefined;

export function getMarketDataProvider() {
  provider ??= new CachedMarketDataProvider(new FmpMarketDataProvider());
  return provider;
}

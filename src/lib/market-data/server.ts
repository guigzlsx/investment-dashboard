import { isEodhdEnabled } from "../config/env";
import { MARKET_DATA_TTL_MS } from "./cache";
import { type MarketDataCapability, getNegativeCapability, rememberNegativeCapability } from "./capabilities";
import { EodhdMarketDataProvider } from "./eodhd";
import { MarketDataProviderError } from "./errors";
import { boundedHistoryQuery } from "./history-window";
import { FmpMarketDataProvider } from "./fmp";
import type { Asset, CompanyProfile, FinancialStatement, HistoricalPrice, KeyMetrics, MarketDataProviderId, Quote } from "./models";
import { withPersistentMarketCache } from "./persistent-cache";
import type { HistoricalPriceQuery, MarketDataProvider } from "./provider";
import { type MarketDataAssetContext, resolveProviderSymbol } from "./symbols";

class CachedMarketDataProvider implements MarketDataProvider {
  constructor(private readonly providerId: MarketDataProviderId, private readonly provider: MarketDataProvider) {}

  searchAssets(query: string) {
    const normalized = query.trim().toLowerCase();
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:search:${normalized}`, resourceType: "search", ttlMs: MARKET_DATA_TTL_MS.search, loader: () => this.provider.searchAssets(query) });
  }

  getQuote(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:quote:${normalized}`, resourceType: "quote", ttlMs: MARKET_DATA_TTL_MS.quote, loader: () => this.provider.getQuote(normalized) });
  }

  getHistoricalPrices(symbol: string, query?: HistoricalPriceQuery) {
    const normalized = symbol.trim().toUpperCase();
    const bounded = boundedHistoryQuery(query);
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:history:${normalized}:${JSON.stringify(bounded ?? {})}`, resourceType: "historical_prices", ttlMs: MARKET_DATA_TTL_MS.historicalPrices, loader: () => this.provider.getHistoricalPrices(normalized, bounded) });
  }

  getCompanyProfile(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:profile:${normalized}`, resourceType: "company_profile", ttlMs: MARKET_DATA_TTL_MS.profile, loader: () => this.provider.getCompanyProfile(normalized) });
  }

  getFinancials(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:financials:${normalized}`, resourceType: "financials", ttlMs: MARKET_DATA_TTL_MS.financials, loader: () => this.provider.getFinancials(normalized) });
  }

  getKeyMetrics(symbol: string) {
    const normalized = symbol.trim().toUpperCase();
    return withPersistentMarketCache({ provider: this.providerId, key: `${this.providerId}:metrics:${normalized}`, resourceType: "key_metrics", ttlMs: MARKET_DATA_TTL_MS.keyMetrics, loader: () => this.provider.getKeyMetrics(normalized) });
  }
}

type AssetAwareProvider = MarketDataAssetContext;

function routingSymbol(capability: MarketDataCapability, asset: AssetAwareProvider, provider: MarketDataProviderId) {
  return capability === "SEARCH" ? asset.symbol : resolveProviderSymbol(asset, provider);
}

function fallbackAllowed(error: unknown) {
  return error instanceof MarketDataProviderError && ["PLAN_REQUIRED", "UNSUPPORTED_SYMBOL", "NOT_FOUND", "RATE_LIMIT", "UPSTREAM"].includes(error.code);
}

function providerError(error: unknown) {
  return error instanceof MarketDataProviderError ? error : new MarketDataProviderError(error instanceof Error ? error.message : "Market data provider failed", "PROVIDER_ERROR");
}

export class CompositeMarketDataProvider implements MarketDataProvider {
  private readonly providers: Partial<Record<MarketDataProviderId, CachedMarketDataProvider>>;

  constructor(options: { fmp?: MarketDataProvider; eodhd?: MarketDataProvider } = {}) {
    this.providers = {
      FMP: new CachedMarketDataProvider("FMP", options.fmp ?? new FmpMarketDataProvider()),
      ...(isEodhdEnabled() || options.eodhd ? { EODHD: new CachedMarketDataProvider("EODHD", options.eodhd ?? new EodhdMarketDataProvider()) } : {}),
    };
  }

  private order(capability: MarketDataCapability, asset: AssetAwareProvider): MarketDataProviderId[] {
    const eodhdCanServeCapability = capability === "QUOTE" || capability === "HISTORY" || capability === "SEARCH";
    const hasEodhdSymbol = Boolean(eodhdCanServeCapability && this.providers.EODHD && routingSymbol(capability, asset, "EODHD"));
    const fmpNegative = Boolean(getNegativeCapability("FMP", capability, asset.symbol));
    const eodhdSymbol = routingSymbol(capability, asset, "EODHD") ?? asset.symbol;
    const eodhdNegative = Boolean(getNegativeCapability("EODHD", capability, eodhdSymbol));
    const eodhdFirst = capability === "QUOTE" || capability === "HISTORY" ? /^VUAA\.(DE|L)$/i.test(asset.symbol) : false;
    const preferred: MarketDataProviderId[] = eodhdFirst ? ["EODHD", "FMP"] : ["FMP", "EODHD"];
    return preferred.filter((provider): provider is MarketDataProviderId => {
      if (!this.providers[provider]) return false;
      if (provider === "EODHD" && (!hasEodhdSymbol || eodhdNegative)) return false;
      if (provider === "FMP" && fmpNegative) return false;
      return true;
    });
  }

  private async route<T>(capability: MarketDataCapability, asset: AssetAwareProvider, operation: (provider: CachedMarketDataProvider, providerSymbol: string) => Promise<T>, normalize: (result: T, provider: MarketDataProviderId, providerSymbol: string) => T): Promise<T> {
    const order = this.order(capability, asset);
    let lastError: MarketDataProviderError | null = null;
    for (const providerId of order) {
      const provider = this.providers[providerId];
      const providerSymbol = routingSymbol(capability, asset, providerId);
      if (!provider || !providerSymbol) continue;
      try {
        const result = await operation(provider, providerSymbol);
        if (capability === "SEARCH" && Array.isArray(result) && result.length === 0) {
          const next = order.find((candidate) => candidate !== providerId && this.providers[candidate] && routingSymbol(capability, asset, candidate));
          if (next) continue;
        }
        console.info("market_data_request", JSON.stringify({ capability, asset: asset.symbol, provider: providerId, providerSymbol, result: "SUCCESS" }));
        return normalize(result, providerId, providerSymbol);
      } catch (error) {
        const normalized = providerError(error);
        lastError = normalized;
        if (["PLAN_REQUIRED", "UNSUPPORTED_SYMBOL", "RATE_LIMIT"].includes(normalized.code)) rememberNegativeCapability(providerId, capability, providerSymbol, normalized.code);
        console.info("market_data_request", JSON.stringify({ capability, asset: asset.symbol, provider: providerId, providerSymbol, result: normalized.code }));
        const next = order.find((candidate) => candidate !== providerId && this.providers[candidate] && routingSymbol(capability, asset, candidate));
        if (next && fallbackAllowed(normalized)) {
          console.info("market_data_fallback", JSON.stringify({ asset: asset.symbol, from: providerId, to: next, reason: normalized.code }));
          continue;
        }
        throw normalized;
      }
    }
    throw lastError ?? new MarketDataProviderError(`No provider can resolve ${asset.symbol} for ${capability}`, "UNSUPPORTED_SYMBOL");
  }

  private context(symbol: string): AssetAwareProvider {
    return { symbol: symbol.trim().toUpperCase() };
  }

  private normalizeQuote(asset: AssetAwareProvider, quote: Quote, provider: MarketDataProviderId, providerSymbol: string): Quote {
    return { ...quote, symbol: asset.symbol, providerSymbol, currency: quote.currency ?? (asset.currency as Quote["currency"] ?? null), exchange: quote.exchange ?? asset.exchange ?? null, provenance: { ...quote.provenance, source: provider, providerSymbol } };
  }

  async getQuote(symbol: string) { return this.getQuoteForAsset(this.context(symbol)); }

  async getQuoteForAsset(asset: AssetAwareProvider): Promise<Quote> {
    return this.route("QUOTE", asset, (provider, providerSymbol) => provider.getQuote(providerSymbol), (quote, provider, providerSymbol) => this.normalizeQuote(asset, quote as Quote, provider, providerSymbol));
  }

  async getHistoricalPrices(symbol: string, query?: HistoricalPriceQuery) { return this.getHistoricalPricesForAsset(this.context(symbol), query); }

  async getHistoricalPricesForAsset(asset: AssetAwareProvider, query?: HistoricalPriceQuery): Promise<HistoricalPrice[]> {
    return this.route("HISTORY", asset, (provider, providerSymbol) => provider.getHistoricalPrices(providerSymbol, query), (prices, provider, providerSymbol) => (prices as HistoricalPrice[]).map((price) => ({ ...price, symbol: asset.symbol, providerSymbol, provenance: { ...price.provenance, source: provider, providerSymbol } })));
  }

  async searchAssets(query: string) {
    return this.route("SEARCH", this.context(query), (provider, providerSymbol) => provider.searchAssets(providerSymbol), (assets) => assets as Asset[]);
  }

  async getCompanyProfile(symbol: string) {
    return this.route("PROFILE", this.context(symbol), (provider, providerSymbol) => provider.getCompanyProfile(providerSymbol), (profile, provider, providerSymbol) => ({ ...(profile as CompanyProfile), symbol: symbol.toUpperCase(), provenance: { ...(profile as CompanyProfile).provenance, source: provider, providerSymbol } }));
  }

  async getFinancials(symbol: string) {
    return this.route("FINANCIALS", this.context(symbol), (provider, providerSymbol) => provider.getFinancials(providerSymbol), (items, provider, providerSymbol) => (items as FinancialStatement[]).map((item) => ({ ...item, symbol: symbol.toUpperCase(), provenance: { ...item.provenance, source: provider, providerSymbol } })));
  }

  async getKeyMetrics(symbol: string) {
    return this.route("METRICS", this.context(symbol), (provider, providerSymbol) => provider.getKeyMetrics(providerSymbol), (items, provider, providerSymbol) => (items as KeyMetrics[]).map((item) => ({ ...item, symbol: symbol.toUpperCase(), provenance: { ...item.provenance, source: provider, providerSymbol } })));
  }
}

let provider: MarketDataProvider | undefined;

export function getMarketDataProvider(): MarketDataProvider {
  provider ??= new CompositeMarketDataProvider();
  return provider;
}

export function resetMarketDataProviderForTests() {
  provider = undefined;
}

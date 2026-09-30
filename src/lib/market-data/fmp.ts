import { getFmpApiKey, getFmpDataKind } from "../config/env";
import type { AssetType, Currency } from "../portfolio/types";
import { MarketDataProviderError } from "./errors";
import type { HistoricalPriceQuery, MarketDataProvider } from "./provider";
import type { Asset, CompanyProfile, DataKind, DataProvenance, FinancialStatement, HistoricalPrice, KeyMetrics, Quote } from "./models";

const FMP_BASE_URL = "https://financialmodelingprep.com/stable/";

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function payloadArray(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function currencyOrNull(value: unknown): Currency | null {
  const currency = stringOrNull(value)?.toUpperCase();
  return currency === "EUR" || currency === "USD" || currency === "CHF" || currency === "GBP" ? currency : null;
}

function assetTypeOrNull(value: unknown): AssetType | null {
  const type = stringOrNull(value)?.toUpperCase();
  return type === "STOCK" || type === "ETF" ? type : null;
}

function dataKind(): DataKind {
  return getFmpDataKind();
}

function provenance(endpoint: string, fetchedAt: string, asOfDate: string | null = null): DataProvenance {
  return {
    source: "FMP",
    sourceEndpoint: endpoint,
    timestamp: fetchedAt,
    asOfDate,
    dataKind: dataKind(),
    freshness: asOfDate && asOfDate < fetchedAt.slice(0, 10) ? "STALE" : "UNKNOWN",
  };
}

function endpointDate(value: unknown) {
  const date = stringOrNull(value);
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;
}

export class FmpMarketDataProvider implements MarketDataProvider {
  private async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(path, FMP_BASE_URL);
    for (const [key, value] of Object.entries({ ...params, apikey: getFmpApiKey() })) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new MarketDataProviderError(error instanceof Error ? error.message : "FMP request failed", "UPSTREAM");
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new MarketDataProviderError("FMP authentication failed", "AUTHENTICATION", response.status);
      if (response.status === 404) throw new MarketDataProviderError("FMP resource not found", "NOT_FOUND", response.status);
      if (response.status === 429) throw new MarketDataProviderError("FMP quota reached", "RATE_LIMIT", response.status);
      throw new MarketDataProviderError(`FMP returned HTTP ${response.status}`, "UPSTREAM", response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MarketDataProviderError("FMP returned invalid JSON", "INVALID_RESPONSE", response.status);
    }

    const objectPayload = asRecord(payload);
    if (objectPayload["Error Message"] || objectPayload.error) {
      throw new MarketDataProviderError(String(objectPayload["Error Message"] ?? objectPayload.error), "INVALID_RESPONSE", response.status);
    }
    return payload as T;
  }

  async searchAssets(query: string): Promise<Asset[]> {
    const endpoint = "search-symbol";
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint, { query: query.trim() });
    return payloadArray(payload, ["results"]).flatMap((item) => {
      const record = asRecord(item);
      const symbol = stringOrNull(record.symbol);
      const name = stringOrNull(record.name);
      if (!symbol || !name) return [];
      return [{
        symbol,
        name,
        exchange: stringOrNull(record.exchange),
        exchangeName: stringOrNull(record.exchangeFullName),
        currency: currencyOrNull(record.currency),
        assetType: assetTypeOrNull(record.type),
        country: null,
        sector: null,
        industry: null,
        logoUrl: null,
        provenance: provenance(endpoint, fetchedAt),
      }];
    });
  }

  async getQuote(symbol: string): Promise<Quote> {
    const endpoint = "quote";
    const fetchedAt = new Date().toISOString();
    const payload = payloadArray(await this.request<unknown>(endpoint, { symbol }), ["quote"]);
    const record = asRecord(payload[0]);
    if (!stringOrNull(record.symbol)) throw new MarketDataProviderError(`No quote found for ${symbol}`, "NOT_FOUND");
    const asOfDate = record.timestamp ? new Date(Number(record.timestamp) * 1000).toISOString().slice(0, 10) : null;
    return {
      symbol: stringOrNull(record.symbol) ?? symbol,
      price: numberOrNull(record.price),
      currency: currencyOrNull(record.currency),
      change1D: numberOrNull(record.change),
      change1DPercent: numberOrNull(record.changesPercentage),
      marketCap: numberOrNull(record.marketCap),
      volume: numberOrNull(record.volume),
      yearHigh: numberOrNull(record.yearHigh),
      yearLow: numberOrNull(record.yearLow),
      provenance: provenance(endpoint, fetchedAt, asOfDate),
    };
  }

  async getHistoricalPrices(symbol: string, query: HistoricalPriceQuery = {}): Promise<HistoricalPrice[]> {
    const endpoint = "historical-price-eod/full";
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint, { symbol, from: query.from, to: query.to, limit: query.limit });
    return payloadArray(payload, ["historical", "data"]).flatMap((item) => {
      const record = asRecord(item);
      const date = endpointDate(record.date);
      if (!date) return [];
      return [{ symbol, date, open: numberOrNull(record.open), high: numberOrNull(record.high), low: numberOrNull(record.low), close: numberOrNull(record.close), volume: numberOrNull(record.volume), currency: currencyOrNull(record.currency), provenance: provenance(endpoint, fetchedAt, date) }];
    });
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const endpoint = "profile";
    const fetchedAt = new Date().toISOString();
    const payload = payloadArray(await this.request<unknown>(endpoint, { symbol }), ["profile", "data"]);
    const record = asRecord(payload[0]);
    if (!stringOrNull(record.symbol)) throw new MarketDataProviderError(`No profile found for ${symbol}`, "NOT_FOUND");
    return { symbol, name: stringOrNull(record.companyName), description: stringOrNull(record.description), website: stringOrNull(record.website), country: stringOrNull(record.country), sector: stringOrNull(record.sector), industry: stringOrNull(record.industry), employees: numberOrNull(record.fullTimeEmployees), provenance: provenance(endpoint, fetchedAt) };
  }

  async getFinancials(symbol: string): Promise<FinancialStatement[]> {
    const endpoint = "income-statement";
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint, { symbol, limit: 5 });
    return payloadArray(payload, ["income", "financials", "data"]).flatMap((item) => {
      const record = asRecord(item);
      const period = stringOrNull(record.period);
      if (!period) return [];
      return [{ symbol, period, periodEnd: endpointDate(record.date), reportedCurrency: currencyOrNull(record.reportedCurrency), revenue: numberOrNull(record.revenue), grossProfit: numberOrNull(record.grossProfit), operatingIncome: numberOrNull(record.operatingIncome), netIncome: numberOrNull(record.netIncome), eps: numberOrNull(record.epsdiluted ?? record.eps), operatingCashFlow: numberOrNull(record.operatingCashFlow ?? record.netCashProvidedByOperatingActivities), freeCashFlow: numberOrNull(record.freeCashFlow), totalDebt: numberOrNull(record.totalDebt), cash: numberOrNull(record.cashAndCashEquivalents), provenance: provenance(endpoint, fetchedAt, endpointDate(record.date)) }];
    });
  }

  async getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
    const endpoint = "ratios";
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint, { symbol, limit: 5 });
    return payloadArray(payload, ["ratios", "data"]).flatMap((item) => {
      const record = asRecord(item);
      const period = stringOrNull(record.period);
      if (!period) return [];
      return [{ symbol, period, periodEnd: endpointDate(record.date), marketCap: numberOrNull(record.marketCap), pe: numberOrNull(record.priceToEarningsRatio), forwardPe: numberOrNull(record.forwardPriceToEarningsRatio), peg: numberOrNull(record.priceToEarningsGrowthRatio), priceToSales: numberOrNull(record.priceToSalesRatio), evToEbitda: numberOrNull(record.enterpriseValueMultiple), grossMargin: numberOrNull(record.grossProfitMargin), operatingMargin: numberOrNull(record.operatingProfitMargin), netMargin: numberOrNull(record.netProfitMargin), debtToEquity: numberOrNull(record.debtToEquityRatio), revenueGrowth: numberOrNull(record.revenueGrowth ?? record.revenueGrowthPercentage), fcfYield: numberOrNull(record.freeCashFlowYield), roic: numberOrNull(record.returnOnInvestedCapital), roe: numberOrNull(record.returnOnEquity), provenance: provenance(endpoint, fetchedAt, endpointDate(record.date)) }];
    });
  }
}

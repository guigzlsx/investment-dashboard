import { getEodhdApiKey, getEodhdBaseUrl } from "../config/env";
import type { AssetType, Currency } from "../portfolio/types";
import { MarketDataProviderError } from "./errors";
import type { HistoricalPriceQuery, MarketDataProvider } from "./provider";
import type { Asset, CompanyProfile, DataProvenance, FinancialStatement, HistoricalPrice, KeyMetrics, Quote } from "./models";

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
  return typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "NA" ? value.trim() : null;
}

function numberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && value.trim().toUpperCase() !== "NA" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function currencyOrNull(value: unknown): Currency | null {
  const currency = stringOrNull(value)?.toUpperCase();
  return currency === "EUR" || currency === "USD" || currency === "CHF" || currency === "GBP" ? currency : null;
}

function assetTypeOrNull(value: unknown): AssetType | null {
  const type = stringOrNull(value)?.toUpperCase();
  if (type === "ETF" || type?.includes("ETF")) return "ETF";
  if (type === "STOCK" || type === "EQUITY" || type?.includes("COMMON STOCK")) return "STOCK";
  return null;
}

function dateOnly(value: unknown) {
  const date = stringOrNull(value);
  return date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null;
}

function providerTimestamp(value: unknown) {
  const numeric = numberOrNull(value);
  if (numeric !== null) {
    const date = new Date(numeric * 1000);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  const text = stringOrNull(value);
  if (text) {
    const date = new Date(text);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return null;
}

function provenance(endpoint: string, fetchedAt: string, dataKind: "DELAYED" | "EOD", asOfDate: string | null, providerSymbol: string, providerTimestamp?: string | null): DataProvenance {
  return { source: "EODHD", sourceEndpoint: endpoint, timestamp: fetchedAt, asOfDate, dataKind, freshness: "FRESH", providerSymbol, providerTimestamp };
}

function providerExchange(symbol: string) {
  return symbol.split(".").slice(1).join(".") || null;
}

function providerCurrency(symbol: string): Currency | null {
  const exchange = providerExchange(symbol);
  if (exchange === "US") return "USD";
  if (symbol === "VUAA.LSE") return "USD";
  if (symbol === "VUAA.XETRA") return "EUR";
  return null;
}

export class EodhdMarketDataProvider implements MarketDataProvider {
  private async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const apiKey = getEodhdApiKey();
    if (!apiKey) throw new MarketDataProviderError("EODHD_API_KEY is not configured", "CONFIGURATION");
    const url = new URL(path, getEodhdBaseUrl());
    for (const [key, value] of Object.entries({ ...params, api_token: apiKey, fmt: "json" })) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new MarketDataProviderError(error instanceof Error ? error.message : "EODHD request failed", "UPSTREAM");
    }

    if (!response.ok) {
      if (response.status === 401) throw new MarketDataProviderError("EODHD authentication failed", "AUTHENTICATION", response.status);
      if (response.status === 402 || response.status === 403) throw new MarketDataProviderError("EODHD subscription does not include this capability", "PLAN_REQUIRED", response.status);
      if (response.status === 404) throw new MarketDataProviderError("EODHD resource not found", "NOT_FOUND", response.status);
      if (response.status === 422) throw new MarketDataProviderError("EODHD rejected the request", "BAD_REQUEST", response.status);
      if (response.status === 429) throw new MarketDataProviderError("EODHD quota reached", "RATE_LIMIT", response.status);
      throw new MarketDataProviderError(`EODHD returned HTTP ${response.status}`, "UPSTREAM", response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new MarketDataProviderError("EODHD returned invalid JSON", "INVALID_RESPONSE", response.status);
    }
    const record = asRecord(payload);
    const error = stringOrNull(record.error ?? record.message);
    if (error) throw new MarketDataProviderError("EODHD returned an error response", "PROVIDER_ERROR", response.status);
    return payload as T;
  }

  async searchAssets(query: string): Promise<Asset[]> {
    const endpoint = `search/${encodeURIComponent(query.trim())}`;
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint);
    return payloadArray(payload, ["results"]).flatMap((item) => {
      const record = asRecord(item);
      const code = stringOrNull(record.Code ?? record.code ?? record.symbol);
      const exchange = stringOrNull(record.Exchange ?? record.exchange);
      const name = stringOrNull(record.Name ?? record.name);
      if (!code || !name) return [];
      const providerSymbol = exchange ? `${code}.${exchange}` : code;
      return [{
        symbol: providerSymbol,
        providerSymbol,
        name,
        isin: stringOrNull(record.ISIN ?? record.isin),
        exchange,
        exchangeName: stringOrNull(record.ExchangeName ?? record.exchange_name),
        currency: currencyOrNull(record.Currency ?? record.currency),
        assetType: assetTypeOrNull(record.Type ?? record.type) ?? (/\bETF\b/i.test(name) ? "ETF" : null),
        country: null,
        sector: null,
        industry: null,
        logoUrl: null,
        provenance: provenance(endpoint, fetchedAt, "EOD", null, providerSymbol),
      }];
    });
  }

  async getQuote(symbol: string): Promise<Quote> {
    const providerSymbol = symbol.trim().toUpperCase();
    const endpoint = `real-time/${providerSymbol}`;
    const fetchedAt = new Date().toISOString();
    const record = asRecord(await this.request<unknown>(endpoint));
    const price = numberOrNull(record.close ?? record.price);
    if (price === null) throw new MarketDataProviderError(`No EODHD quote found for ${providerSymbol}`, "UNSUPPORTED_SYMBOL");
    const providerDate = providerTimestamp(record.timestamp);
    return {
      symbol: providerSymbol,
      providerSymbol,
      price,
      currency: currencyOrNull(record.currency) ?? providerCurrency(providerSymbol),
      exchange: providerExchange(providerSymbol),
      change1D: numberOrNull(record.change),
      change1DPercent: numberOrNull(record.change_p ?? record.changesPercentage),
      marketCap: null,
      volume: numberOrNull(record.volume),
      yearHigh: numberOrNull(record.high_52),
      yearLow: numberOrNull(record.low_52),
      provenance: provenance(endpoint, fetchedAt, "DELAYED", providerDate?.slice(0, 10) ?? null, providerSymbol, providerDate),
    };
  }

  async getHistoricalPrices(symbol: string, query: HistoricalPriceQuery = {}): Promise<HistoricalPrice[]> {
    const providerSymbol = symbol.trim().toUpperCase();
    const endpoint = `eod/${providerSymbol}`;
    const fetchedAt = new Date().toISOString();
    const payload = await this.request<unknown>(endpoint, { from: query.from, to: query.to });
    return payloadArray(payload, ["historical", "data"]).flatMap((item) => {
      const record = asRecord(item);
      const date = dateOnly(record.date);
      if (!date) return [];
      return [{
        symbol: providerSymbol,
        providerSymbol,
        date,
        open: numberOrNull(record.open),
        high: numberOrNull(record.high),
        low: numberOrNull(record.low),
        close: numberOrNull(record.adjusted_close ?? record.close),
        volume: numberOrNull(record.volume),
        currency: currencyOrNull(record.currency) ?? providerCurrency(providerSymbol),
        provenance: provenance(endpoint, fetchedAt, "EOD", date, providerSymbol),
      }];
    });
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const providerSymbol = symbol.trim().toUpperCase();
    const endpoint = `v1.1/fundamentals/${providerSymbol}`;
    const fetchedAt = new Date().toISOString();
    const payload = asRecord(await this.request<unknown>(endpoint));
    const general = asRecord(payload.General);
    const name = stringOrNull(general.Name);
    if (!name) throw new MarketDataProviderError(`No EODHD profile found for ${providerSymbol}`, "NOT_FOUND");
    return { symbol: providerSymbol, name, description: stringOrNull(general.Description), website: stringOrNull(general.WebURL), country: stringOrNull(general.CountryName), sector: stringOrNull(general.Sector), industry: stringOrNull(general.Industry), employees: numberOrNull(general.FullTimeEmployees), provenance: provenance(endpoint, fetchedAt, "EOD", null, providerSymbol) };
  }

  async getFinancials(symbol: string): Promise<FinancialStatement[]> {
    const providerSymbol = symbol.trim().toUpperCase();
    const endpoint = `v1.1/fundamentals/${providerSymbol}`;
    const fetchedAt = new Date().toISOString();
    const payload = asRecord(await this.request<unknown>(endpoint));
    const income = asRecord(payload.Financials).Income_Statement;
    return Object.entries(asRecord(income)).flatMap(([period, value]) => {
      const record = asRecord(value);
      return [{ symbol: providerSymbol, period, periodEnd: dateOnly(record.date), reportedCurrency: currencyOrNull(record.currency), revenue: numberOrNull(record.totalRevenue), grossProfit: numberOrNull(record.grossProfit), operatingIncome: numberOrNull(record.operatingIncome), netIncome: numberOrNull(record.netIncome), eps: numberOrNull(record.dilutedEPS), operatingCashFlow: null, freeCashFlow: null, totalDebt: null, cash: null, provenance: provenance(endpoint, fetchedAt, "EOD", dateOnly(record.date), providerSymbol) }];
    });
  }

  async getKeyMetrics(symbol: string): Promise<KeyMetrics[]> {
    const providerSymbol = symbol.trim().toUpperCase();
    const endpoint = `v1.1/fundamentals/${providerSymbol}`;
    const fetchedAt = new Date().toISOString();
    const payload = asRecord(await this.request<unknown>(endpoint));
    const highlights = asRecord(payload.Highlights);
    return [{ symbol: providerSymbol, period: null, periodEnd: null, marketCap: numberOrNull(highlights.MarketCapitalization), pe: numberOrNull(highlights.PERatio), forwardPe: null, peg: numberOrNull(highlights.PEGRatio), priceToSales: null, evToEbitda: null, grossMargin: null, operatingMargin: null, netMargin: null, debtToEquity: null, revenueGrowth: numberOrNull(highlights.QuarterlyRevenueGrowthYOY), fcfYield: null, roic: null, roe: null, provenance: provenance(endpoint, fetchedAt, "EOD", null, providerSymbol) }];
  }
}

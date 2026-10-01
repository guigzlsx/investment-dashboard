import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetResolver } from "./asset-resolver";
import type { NormalizedImportedTransaction } from "./types";
import { findAssetByIsin, listAssetsBySymbol } from "../supabase/repositories";
import { getMarketDataProvider } from "../market-data/server";
import { MarketDataProviderError } from "../market-data/errors";

vi.mock("../supabase/repositories", () => ({ findAssetByIsin: vi.fn(), listAssetsBySymbol: vi.fn() }));
vi.mock("../market-data/server", () => ({ getMarketDataProvider: vi.fn() }));

const row = (values: Partial<NormalizedImportedTransaction>): NormalizedImportedTransaction => ({ sourceRow: 2, assetIdentifier: "NVDA", symbol: "NVDA", name: null, isin: null, exchange: null, assetId: null, assetType: null, transactionType: "BUY", quantity: 1, price: 100, currency: "USD", fees: 0, transactionDate: "2026-01-15T00:00:00.000Z", fxRateToBase: null, confidence: "MEDIUM", warnings: [], errors: [], status: "READY", possibleDuplicate: false, assetResolution: null, ...values });

describe("portfolio import asset resolution", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(findAssetByIsin).mockResolvedValue(null); vi.mocked(listAssetsBySymbol).mockResolvedValue([]); });

  it("prefers an exact ISIN match", async () => {
    vi.mocked(findAssetByIsin).mockResolvedValue({ id: "asset-1", symbol: "NVDA", name: "NVIDIA", isin: "US67066G1040", exchange: "NASDAQ", currency: "USD", asset_type: "STOCK" });
    const result = await new AssetResolver({} as never).resolve(row({ assetIdentifier: "US67066G1040", symbol: null, isin: "US67066G1040" }));
    expect(result).toMatchObject({ assetId: "asset-1", confidence: "HIGH", reason: "ISIN_MATCH", requiresReview: false });
  });

  it("does not silently choose between same-ticker assets", async () => {
    vi.mocked(listAssetsBySymbol).mockResolvedValue([
      { id: "asset-1", symbol: "ABC", name: "ABC US", isin: null, exchange: "NYSE", currency: "USD", asset_type: "STOCK" },
      { id: "asset-2", symbol: "ABC", name: "ABC London", isin: null, exchange: "LSE", currency: "GBP", asset_type: "STOCK" },
    ]);
    const result = await new AssetResolver({} as never).resolve(row({ assetIdentifier: "ABC", symbol: "ABC", currency: null }));
    expect(result).toMatchObject({ assetId: null, requiresReview: true, reason: "AMBIGUOUS", confidence: "LOW" });
  });

  it("marks a unique provider ticker match as ready", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => [{ symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", exchangeName: "NASDAQ", isin: null, currency: "USD", assetType: "STOCK", country: "US", sector: "Technology", industry: "Semiconductors", logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } }],
      getQuote: async () => { throw new Error("unused"); },
      getHistoricalPrices: async () => [],
      getCompanyProfile: async () => { throw new Error("unused"); },
      getFinancials: async () => [],
      getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "NVDA", assetIdentifier: "NVDA" }));
    expect(result).toMatchObject({ symbol: "NVDA", confidence: "HIGH", requiresReview: false, reason: "PROVIDER_SEARCH" });
  });

  it("accepts an existing exact ticker asset before querying the provider", async () => {
    vi.mocked(listAssetsBySymbol).mockResolvedValue([{ id: "asset-nvda", symbol: "NVDA", name: "NVIDIA Corporation", isin: null, exchange: "NASDAQ", currency: "USD", asset_type: "STOCK" }]);
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "NVDA", assetIdentifier: "NVDA" }));
    expect(getMarketDataProvider).not.toHaveBeenCalled();
    expect(result).toMatchObject({ assetId: "asset-nvda", reason: "EXISTING_ASSET", requiresReview: false });
  });

  it("keeps compatible European listings when a provider has no bare ETF ticker", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => [
        { symbol: "VUAA.L", name: "Vanguard S&P 500 UCITS ETF (USD) Accumulating", exchange: "LSE", exchangeName: "London Stock Exchange", isin: null, currency: "USD", assetType: null, country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
        { symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", exchangeName: "Italian Stock Exchange", isin: null, currency: "EUR", assetType: null, country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
        { symbol: "VUAA.SG", name: "Vanguard S&P 500 UCITS ETF", exchange: "STU", exchangeName: "Stuttgart Stock Exchange", isin: null, currency: "EUR", assetType: null, country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
        { symbol: "VUAA.DE", name: "Vanguard S&P 500 UCITS ETF (USD) Accumulating", exchange: "XETRA", exchangeName: "Deutsche Börse", isin: null, currency: "EUR", assetType: null, country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
      ],
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "VUAA", assetIdentifier: "VUAA", currency: "EUR" }));
    expect(result).toMatchObject({ reason: "AMBIGUOUS", requiresReview: true, trace: { providerResults: 4, tickerResults: 4, contextResults: 3 } });
    expect(result.candidates.map((candidate) => candidate.symbol)).toEqual(["VUAA.MI", "VUAA.SG", "VUAA.DE"]);
  });

  it("accepts a unique compatible listing for a ticker without a bare provider symbol", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => [{ symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", exchangeName: "Italian Stock Exchange", isin: null, currency: "EUR", assetType: "ETF", country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } }],
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "VUAA", assetIdentifier: "VUAA", currency: "EUR" }));
    expect(result).toMatchObject({ symbol: "VUAA.MI", confidence: "MEDIUM", requiresReview: false, reason: "PROVIDER_SEARCH" });
  });

  it("reuses a previously selected provider listing on the next import", async () => {
    vi.mocked(listAssetsBySymbol).mockImplementation(async (_supabase, symbol) => symbol === "VUAA.MI" ? [{ id: "asset-vuaa", symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", isin: null, exchange: "MIL", currency: "EUR", asset_type: "ETF" }] : []);
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => [
        { symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", exchangeName: "Italian Stock Exchange", isin: null, currency: "EUR", assetType: "ETF", country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
        { symbol: "VUAA.SG", name: "Vanguard S&P 500 UCITS ETF", exchange: "STU", exchangeName: "Stuttgart Stock Exchange", isin: null, currency: "EUR", assetType: "ETF", country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } },
      ],
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "VUAA", assetIdentifier: "VUAA", currency: "EUR" }));
    expect(result).toMatchObject({ assetId: "asset-vuaa", reason: "EXISTING_ASSET", requiresReview: false });
  });

  it("distinguishes provider failure from an unknown ticker", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => { throw new MarketDataProviderError("quota", "RATE_LIMIT", 429); },
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "AMZN", assetIdentifier: "AMZN" }));
    expect(result).toMatchObject({ reason: "PROVIDER_ERROR", providerErrorCode: "RATE_LIMIT", requiresReview: true });
  });

  it("keeps an unknown ticker distinct from a provider failure", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => [],
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const result = await new AssetResolver({} as never).resolve(row({ symbol: "UNKNOWN", assetIdentifier: "UNKNOWN" }));
    expect(result).toMatchObject({ reason: "NOT_FOUND", requiresReview: true });
  });
});

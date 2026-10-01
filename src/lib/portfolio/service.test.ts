import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarketDataProviderError } from "../market-data/errors";
import type { PortfolioTransaction } from "./types";

const mocks = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  listTransactions: vi.fn(),
  listLatestMarketQuotes: vi.fn(),
  persistFxRate: vi.fn(),
  persistMarketQuote: vi.fn(),
  getEcbFxRateProvider: vi.fn(),
  getMarketDataProvider: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getRates: vi.fn(),
  getQuote: vi.fn(),
}));

vi.mock("../supabase/repositories", () => ({
  getDefaultPortfolio: mocks.getDefaultPortfolio,
  listTransactions: mocks.listTransactions,
  listLatestMarketQuotes: mocks.listLatestMarketQuotes,
  persistFxRate: mocks.persistFxRate,
  persistMarketQuote: mocks.persistMarketQuote,
}));
vi.mock("../fx/ecb", () => ({ getEcbFxRateProvider: mocks.getEcbFxRateProvider }));
vi.mock("../market-data/server", () => ({ getMarketDataProvider: mocks.getMarketDataProvider }));
vi.mock("../supabase/admin", () => ({ createSupabaseAdminClient: mocks.createSupabaseAdminClient }));

import { getPortfolioValuation } from "./service";

function transaction(overrides: Partial<PortfolioTransaction>): PortfolioTransaction {
  return {
    id: "transaction-1",
    portfolioId: "portfolio-1",
    assetId: "asset-1",
    symbol: "VUAA.MI",
    providerSymbol: "VUAA.MI",
    assetCurrency: "EUR",
    type: "BUY",
    quantity: 1,
    unitPrice: 100,
    currency: "EUR",
    quoteCurrency: "EUR",
    fees: 0,
    fxRateToBase: 1,
    executedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("portfolio valuation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDefaultPortfolio.mockResolvedValue({ id: "portfolio-1", user_id: "user-1", name: "Main portfolio", base_currency: "EUR" });
    mocks.listTransactions.mockResolvedValue([
      transaction({ assetId: "asset-vuaa", symbol: "VUAA.MI", providerSymbol: "VUAA.MI", assetCurrency: "EUR", quoteCurrency: "EUR" }),
      transaction({ id: "transaction-2", assetId: "asset-ko", symbol: "KO", providerSymbol: "KO", assetCurrency: undefined, quoteCurrency: "USD", currency: "USD", fxRateToBase: 1.14, unitPrice: 88.13 }),
      transaction({ id: "transaction-3", assetId: "asset-onon", symbol: "ONON", providerSymbol: "ONON", assetCurrency: undefined, quoteCurrency: "USD", currency: "USD", fxRateToBase: 1.14, unitPrice: 29.94 }),
    ]);
    mocks.listLatestMarketQuotes.mockResolvedValue(new Map([
      ["asset-ko", { assetId: "asset-ko", price: 86.15, currency: "USD", change1D: 0.07, source: "FMP", sourceEndpoint: "quote", dataKind: "UNKNOWN", asOf: "2026-10-01T00:00:00.000Z", fetchedAt: "2026-10-01T19:03:58.785Z" }],
    ]));
    mocks.createSupabaseAdminClient.mockImplementation(() => { throw new Error("admin unavailable in unit test"); });
    mocks.getEcbFxRateProvider.mockReturnValue({ getRates: mocks.getRates });
    mocks.getRates.mockResolvedValue([{ fromCurrency: "USD", toCurrency: "EUR", rate: 1.1298, asOfDate: "2026-10-01", timestamp: "2026-10-01T19:04:30.035Z", source: "ECB" }]);
    mocks.getMarketDataProvider.mockReturnValue({ getQuote: mocks.getQuote });
    mocks.getQuote.mockImplementation(async (symbol: string) => {
      if (symbol === "VUAA.MI") return { symbol, price: 132, currency: "EUR", change1D: 1, provenance: { source: "FMP", sourceEndpoint: "quote", timestamp: "2026-10-01T19:05:00.000Z", asOfDate: "2026-10-01", dataKind: "UNKNOWN", freshness: "UNKNOWN" } };
      if (symbol === "KO") throw new MarketDataProviderError("FMP quota reached", "RATE_LIMIT", 429);
      throw new MarketDataProviderError("FMP subscription does not include this query", "PLAN_REQUIRED", 402);
    });
  });

  it("preserves provider symbols, loads FX independently, and classifies mixed valuation state", async () => {
    const result = await getPortfolioValuation({} as never, "user-1");

    expect(mocks.getQuote.mock.calls.map(([symbol]) => symbol)).toEqual(["VUAA.MI", "KO", "ONON"]);
    expect(mocks.getRates).toHaveBeenCalledWith(["EUR", "USD"], "EUR");
    expect(result.summary.currentValue).toBeNull();
    expect(result.summary.dataQuality).toBe("PARTIAL");
    expect(result.summary.positions.find((position) => position.symbol === "KO")?.currentValue).toBeGreaterThan(0);
    expect(result.summary.positions.find((position) => position.symbol === "ONON")?.currentValue).toBeNull();
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ symbol: "VUAA.MI", providerSymbol: "VUAA.MI", reason: "VALUED", marketValueCalculable: true }),
      expect.objectContaining({ symbol: "KO", reason: "STALE_CACHE", providerErrorCode: "RATE_LIMIT", marketValueCalculable: true }),
      expect.objectContaining({ symbol: "ONON", reason: "PROVIDER_ERROR", providerErrorCode: "PLAN_REQUIRED", marketValueCalculable: false }),
    ]));
  });

  it("does not use an over-aged persisted quote as an unlimited fallback", async () => {
    mocks.listTransactions.mockResolvedValue([transaction({ assetId: "asset-onon", symbol: "ONON", providerSymbol: "ONON", assetCurrency: "USD", quoteCurrency: "USD", currency: "USD", fxRateToBase: 1.14 })]);
    mocks.listLatestMarketQuotes.mockResolvedValue(new Map([
      ["asset-onon", { assetId: "asset-onon", price: 30.2, currency: "USD", change1D: 0.1, source: "EODHD", sourceEndpoint: "real-time/ONON.US", dataKind: "DELAYED", asOf: "2025-01-01T00:00:00.000Z", fetchedAt: "2025-01-01T00:00:00.000Z" }],
    ]));
    mocks.getQuote.mockRejectedValue(new MarketDataProviderError("plan", "PLAN_REQUIRED", 402));
    const result = await getPortfolioValuation({} as never, "user-1");
    expect(result.summary.currentValue).toBeNull();
    expect(result.summary.positions[0].currentValue).toBeNull();
    expect(result.diagnostics[0]).toMatchObject({ reason: "PROVIDER_ERROR", marketValueCalculable: false });
  });
});

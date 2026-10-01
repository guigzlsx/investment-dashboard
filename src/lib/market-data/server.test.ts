import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearMemoryCache } from "./cache";
import { clearNegativeCapabilities } from "./capabilities";
import { MarketDataProviderError } from "./errors";
import { CompositeMarketDataProvider } from "./server";
import type { MarketDataProvider } from "./provider";
import type { Quote } from "./models";

function quote(symbol: string, provider: "FMP" | "EODHD"): Quote {
  return { symbol, providerSymbol: symbol, price: 100, currency: "USD", exchange: symbol.endsWith(".US") ? "US" : null, change1D: 1, change1DPercent: 1, marketCap: null, volume: null, yearHigh: null, yearLow: null, provenance: { source: provider, sourceEndpoint: "quote", timestamp: "2026-10-01T00:00:00.000Z", asOfDate: "2026-10-01", dataKind: provider === "EODHD" ? "DELAYED" : "UNKNOWN", freshness: "FRESH" } };
}

function provider(overrides: Partial<MarketDataProvider>): MarketDataProvider {
  return {
    searchAssets: vi.fn().mockResolvedValue([]),
    getQuote: vi.fn().mockRejectedValue(new MarketDataProviderError("unused", "NOT_FOUND")),
    getHistoricalPrices: vi.fn().mockResolvedValue([]),
    getCompanyProfile: vi.fn().mockRejectedValue(new MarketDataProviderError("unused", "NOT_FOUND")),
    getFinancials: vi.fn().mockResolvedValue([]),
    getKeyMetrics: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("composite market data routing", () => {
  beforeEach(() => {
    clearMemoryCache();
    clearNegativeCapabilities();
  });

  it("uses FMP first when it succeeds", async () => {
    const fmp = provider({ getQuote: vi.fn().mockResolvedValue(quote("NVDA", "FMP")) });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue(quote("NVDA.US", "EODHD")) });
    const result = await new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("NVDA");
    expect(result.provenance.source).toBe("FMP");
    expect(fmp.getQuote).toHaveBeenCalledWith("NVDA");
    expect(eodhd.getQuote).not.toHaveBeenCalled();
  });

  it("falls back from FMP plan restriction to EODHD", async () => {
    const fmp = provider({ getQuote: vi.fn().mockRejectedValue(new MarketDataProviderError("plan", "PLAN_REQUIRED", 402)) });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue(quote("ONON.US", "EODHD")) });
    const composite = new CompositeMarketDataProvider({ fmp, eodhd });
    const first = await composite.getQuote("ONON");
    const second = await composite.getQuote("ONON");
    expect(first).toMatchObject({ symbol: "ONON", providerSymbol: "ONON.US", price: 100 });
    expect(second.provenance.source).toBe("EODHD");
    expect(fmp.getQuote).toHaveBeenCalledTimes(1);
    expect(eodhd.getQuote).toHaveBeenCalledTimes(1);
  });

  it("uses the validated STX.US fallback symbol", async () => {
    const fmp = provider({ getQuote: vi.fn().mockRejectedValue(new MarketDataProviderError("plan", "PLAN_REQUIRED", 402)) });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue(quote("STX.US", "EODHD")) });
    const result = await new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("STX");
    expect(result.providerSymbol).toBe("STX.US");
    expect(eodhd.getQuote).toHaveBeenCalledWith("STX.US");
  });

  it("routes validated European listings to their exact EODHD listing", async () => {
    const fmp = provider({ getQuote: vi.fn().mockResolvedValue(quote("VUAA.DE", "FMP")) });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue({ ...quote("VUAA.XETRA", "EODHD"), currency: "EUR" }) });
    const result = await new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("VUAA.DE");
    expect(result).toMatchObject({ symbol: "VUAA.DE", providerSymbol: "VUAA.XETRA", currency: "EUR" });
    expect(eodhd.getQuote).toHaveBeenCalledWith("VUAA.XETRA");
    expect(fmp.getQuote).not.toHaveBeenCalled();
  });

  it("routes the validated London VUAA listing without substituting it", async () => {
    const fmp = provider({ getQuote: vi.fn() });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue({ ...quote("VUAA.LSE", "EODHD"), currency: "USD" }) });
    const result = await new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("VUAA.L");
    expect(result).toMatchObject({ symbol: "VUAA.L", providerSymbol: "VUAA.LSE", currency: "USD" });
    expect(eodhd.getQuote).toHaveBeenCalledWith("VUAA.LSE");
    expect(fmp.getQuote).not.toHaveBeenCalled();
  });

  it("does not substitute the unresolved Italian VUAA listing", async () => {
    const fmp = provider({ getQuote: vi.fn().mockRejectedValue(new MarketDataProviderError("plan", "PLAN_REQUIRED", 402)) });
    const eodhd = provider({ getQuote: vi.fn() });
    await expect(new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("VUAA.MI")).rejects.toMatchObject({ code: "PLAN_REQUIRED" });
    expect(eodhd.getQuote).not.toHaveBeenCalled();
  });

  it("does not hide a bad request behind a fallback", async () => {
    const fmp = provider({ getQuote: vi.fn().mockRejectedValue(new MarketDataProviderError("bad request", "BAD_REQUEST", 422)) });
    const eodhd = provider({ getQuote: vi.fn().mockResolvedValue(quote("ONON.US", "EODHD")) });
    await expect(new CompositeMarketDataProvider({ fmp, eodhd }).getQuote("ONON")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(eodhd.getQuote).not.toHaveBeenCalled();
  });

  it("keeps fundamentals on FMP and does not probe restricted EODHD fundamentals", async () => {
    const fmp = provider({ getFinancials: vi.fn().mockResolvedValue([]) });
    const eodhd = provider({ getFinancials: vi.fn() });
    const result = await new CompositeMarketDataProvider({ fmp, eodhd }).getFinancials("NVDA");
    expect(result).toEqual([]);
    expect(fmp.getFinancials).toHaveBeenCalledWith("NVDA");
    expect(eodhd.getFinancials).not.toHaveBeenCalled();
  });
});

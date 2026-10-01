import { beforeEach, describe, expect, it, vi } from "vitest";
import { FmpMarketDataProvider } from "./fmp";
import { MarketDataProviderError } from "./errors";

describe("FMP asset search", () => {
  beforeEach(() => {
    process.env.FMP_API_KEY = "test-key";
    process.env.FMP_DATA_KIND = "EOD";
  });

  it("classifies ETF names when the search endpoint omits type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", currency: "EUR", type: null }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const [asset] = await new FmpMarketDataProvider().searchAssets("VUAA");
    expect(asset).toMatchObject({ symbol: "VUAA.MI", currency: "EUR", assetType: "ETF" });
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toContain("/stable/search-symbol");
  });

  it("uses search-name for company-like queries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", currency: "USD", type: "Common Stock" }]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new FmpMarketDataProvider().searchAssets("NVIDIA");
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toContain("/stable/search-name");
  });

  it("preserves quota failures as typed provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ "Error Message": "quota" }), { status: 429 })));
    await expect(new FmpMarketDataProvider().searchAssets("NVDA")).rejects.toMatchObject({ code: "RATE_LIMIT", status: 429 } satisfies Partial<MarketDataProviderError>);
  });

  it("preserves plan restrictions as a provider error instead of not found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Premium Query Parameter", { status: 402 })));
    await expect(new FmpMarketDataProvider().getQuote("ONON")).rejects.toMatchObject({ code: "PLAN_REQUIRED", status: 402 } satisfies Partial<MarketDataProviderError>);
  });

  it("uses explicit date windows for bounded history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ historical: [{ date: "2026-09-30", close: 100 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await new FmpMarketDataProvider().getHistoricalPrices("NVDA", { from: "2026-09-01", to: "2026-10-01", limit: 120 });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("from")).toBe("2026-09-01");
    expect(url.searchParams.get("to")).toBe("2026-10-01");
    expect(url.searchParams.has("limit")).toBe(false);
  });
});

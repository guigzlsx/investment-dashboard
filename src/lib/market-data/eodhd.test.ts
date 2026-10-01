import { beforeEach, describe, expect, it, vi } from "vitest";
import { EodhdMarketDataProvider } from "./eodhd";

function response(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("EODHD adapter", () => {
  beforeEach(() => {
    process.env.EODHD_API_KEY = "test-key-not-logged";
    vi.restoreAllMocks();
  });

  it("normalizes a delayed quote without exposing the API token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { close: 30.2, change: 0.59, change_p: 1.99, timestamp: 1790886300, volume: 100 }));
    vi.stubGlobal("fetch", fetchMock);
    const quote = await new EodhdMarketDataProvider().getQuote("ONON.US");
    expect(quote).toMatchObject({ symbol: "ONON.US", providerSymbol: "ONON.US", price: 30.2, exchange: "US", currency: "USD", provenance: { source: "EODHD", dataKind: "DELAYED", providerSymbol: "ONON.US" } });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/api/real-time/ONON.US");
    expect(url).toContain("api_token=");
  });

  it("passes bounded from/to history windows and marks them EOD", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, [{ date: "2026-09-30", open: 29, high: 31, low: 28, close: 30, volume: 42 }]));
    vi.stubGlobal("fetch", fetchMock);
    const history = await new EodhdMarketDataProvider().getHistoricalPrices("ONON.US", { from: "2026-09-29", to: "2026-10-01" });
    expect(history[0]).toMatchObject({ symbol: "ONON.US", providerSymbol: "ONON.US", date: "2026-09-30", close: 30, provenance: { dataKind: "EOD" } });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain("/api/eod/ONON.US");
    expect(url.searchParams.get("from")).toBe("2026-09-29");
    expect(url.searchParams.get("to")).toBe("2026-10-01");
  });

  it("uses the path-based EODHD search endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, [{ Code: "VUAA", Exchange: "XETRA", Name: "Vanguard S&P 500 UCITS ETF Acc", Currency: "EUR", Type: "ETF" }]));
    vi.stubGlobal("fetch", fetchMock);
    const [asset] = await new EodhdMarketDataProvider().searchAssets("VUAA");
    expect(asset).toMatchObject({ symbol: "VUAA.XETRA", providerSymbol: "VUAA.XETRA", exchange: "XETRA", currency: "EUR", assetType: "ETF" });
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toContain("/api/search/VUAA");
  });

  it("normalizes the validated plan restriction", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(403, { error: "forbidden" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new EodhdMarketDataProvider().getCompanyProfile("ONON.US")).rejects.toMatchObject({ code: "PLAN_REQUIRED", status: 403 });
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toContain("/api/v1.1/fundamentals/ONON.US");
  });
});

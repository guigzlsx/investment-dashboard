import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Asset } from "../market-data/models";
import { MarketDataProviderError } from "../market-data/errors";
import { getMarketDataProvider } from "../market-data/server";
import { getDefaultPortfolio, listAssetThemes, listAssetsBySymbol, listTransactions } from "../supabase/repositories";
import { buildPortfolioImportPreview } from "./service";
import { importRowAction } from "./presentation";

vi.mock("../supabase/repositories", () => ({
  getDefaultPortfolio: vi.fn(),
  listAssetThemes: vi.fn(),
  listAssetsBySymbol: vi.fn(),
  listTransactions: vi.fn(),
  findAssetByIsin: vi.fn(),
}));
vi.mock("../market-data/server", () => ({ getMarketDataProvider: vi.fn() }));

const fixture = readFileSync(new URL("./fixtures/revolut-brokerage.csv", import.meta.url));
const user = { id: "user-1" } as never;
const savedRows: Array<{ status: string; normalized_data: Record<string, unknown> }> = [];

function providerAsset(symbol: string, name: string, exchange: string, currency: "EUR" | "USD", assetType: "STOCK" | "ETF" = "STOCK"): Asset {
  return { symbol, name, exchange, exchangeName: exchange, currency, assetType, id: undefined, isin: null, country: null, sector: null, industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "search-symbol", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: null, dataKind: "UNKNOWN", freshness: "UNKNOWN" } };
}

function fakeSupabase(importExists = false) {
  return {
    from(table: string) {
      const query = {
        select() { return query; },
        eq() { return query; },
        insert(values: unknown) {
          if (table === "portfolio_import_rows" && Array.isArray(values)) savedRows.push(...values as Array<{ status: string; normalized_data: Record<string, unknown> }>);
          return query;
        },
        update() { return query; },
        delete() { return query; },
        order() {
          if (table === "portfolio_import_rows") {
            return Promise.resolve({
              data: savedRows.map((row) => ({ source_row: Number(row.normalized_data.sourceRow), normalized_data: row.normalized_data })),
              error: null,
            });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle() { return Promise.resolve({ data: importExists ? { id: "import-1" } : null, error: null }); },
        single() { return Promise.resolve({ data: { id: "import-1" }, error: null }); },
        then(resolve: (value: { data: null; error: null }) => unknown) { return Promise.resolve({ data: null, error: null }).then(resolve); },
      };
      return query;
    },
  } as never;
}

describe("portfolio import preview pipeline", () => {
  beforeEach(() => {
    savedRows.length = 0;
    vi.clearAllMocks();
    vi.mocked(getDefaultPortfolio).mockResolvedValue({ id: "portfolio-1", user_id: "user-1", name: "Main portfolio", base_currency: "EUR" });
    vi.mocked(listTransactions).mockResolvedValue([]);
    vi.mocked(listAssetThemes).mockResolvedValue(new Map());
    vi.mocked(listAssetsBySymbol).mockResolvedValue([]);
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async (query) => {
        const symbol = query.toUpperCase();
        if (symbol === "VUAA") return [providerAsset("VUAA.MI", "Vanguard S&P 500 UCITS ETF", "MIL", "EUR", "ETF"), providerAsset("VUAA.SG", "Vanguard S&P 500 UCITS ETF", "STU", "EUR", "ETF"), providerAsset("VUAA.DE", "Vanguard S&P 500 UCITS ETF", "XETRA", "EUR", "ETF")];
        const names: Record<string, [string, string, "EUR" | "USD"]> = { ONON: ["On Holding AG", "NYSE", "USD"], KO: ["The Coca-Cola Company", "NYSE", "USD"], NVDA: ["NVIDIA Corporation", "NASDAQ", "USD"], STX: ["Seagate Technology Holdings plc", "NASDAQ", "USD"], AMZN: ["Amazon.com, Inc.", "NASDAQ", "USD"] };
        const [name, exchange, currency] = names[symbol] ?? [symbol, "NASDAQ", "USD"];
        return [providerAsset(symbol, name, exchange, currency)];
      },
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
  });

  it("propagates STX READY and VUAA ambiguity into persisted preview state", async () => {
    const preview = await buildPortfolioImportPreview(fakeSupabase(), user, { fileName: "revolut-brokerage.csv", buffer: fixture });
    const stx = preview.rows.find((row) => row.symbol === "STX");
    const vuaa = preview.rows.find((row) => row.symbol === "VUAA");
    expect(stx).toMatchObject({ status: "READY", assetResolution: { requiresReview: false, reason: "PROVIDER_SEARCH", symbol: "STX", name: "Seagate Technology Holdings plc" } });
    expect(vuaa).toMatchObject({ status: "ERROR", assetResolution: { requiresReview: true, reason: "AMBIGUOUS", candidates: [{ symbol: "VUAA.MI" }, { symbol: "VUAA.SG" }, { symbol: "VUAA.DE" }] } });
    expect(savedRows.find((row) => row.normalized_data.symbol === "STX")?.status).toBe("READY");
    expect(savedRows.find((row) => row.normalized_data.symbol === "VUAA")?.status).toBe("ERROR");
  });

  it("applies a VUAA selection to the same session and returns READY", async () => {
    const preview = await buildPortfolioImportPreview(fakeSupabase(), user, { fileName: "revolut-brokerage.csv", buffer: fixture });
    const selected = await buildPortfolioImportPreview(fakeSupabase(true), user, { fileName: "revolut-brokerage.csv", buffer: fixture, importId: preview.importId, selections: { "5": "VUAA.MI|MIL" } });
    const vuaa = selected.rows.find((row) => row.assetIdentifier === "VUAA");
    expect(vuaa).toMatchObject({ status: "READY", assetResolution: { requiresReview: false, symbol: "VUAA.MI", exchange: "MIL", reason: "EXISTING_ASSET" } });
    expect(importRowAction(vuaa!)).toBe("NONE");
  });

  it("keeps a provider rate limit as Retry instead of Choose asset", async () => {
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async () => { throw new MarketDataProviderError("quota", "RATE_LIMIT", 429); },
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });
    const preview = await buildPortfolioImportPreview(fakeSupabase(), user, { fileName: "revolut-brokerage.csv", buffer: fixture });
    const stx = preview.rows.find((row) => row.symbol === "STX");
    expect(stx).toMatchObject({ status: "ERROR", assetResolution: { reason: "PROVIDER_ERROR", providerErrorCode: "RATE_LIMIT", candidates: [] } });
    expect(importRowAction(stx!)).toBe("RETRY");
  });

  it("retries only the requested row and preserves the other persisted resolutions", async () => {
    const calls: string[] = [];
    let firstAttempt = true;
    vi.mocked(getMarketDataProvider).mockReturnValue({
      searchAssets: async (query) => {
        const symbol = query.toUpperCase();
        calls.push(symbol);
        if (symbol === "STX" && firstAttempt) throw new MarketDataProviderError("quota", "RATE_LIMIT", 429);
        if (symbol === "STX") return [providerAsset("STX", "Seagate Technology Holdings plc", "NASDAQ", "USD")];
        if (symbol === "VUAA") return [providerAsset("VUAA.MI", "Vanguard S&P 500 UCITS ETF", "MIL", "EUR", "ETF"), providerAsset("VUAA.SG", "Vanguard S&P 500 UCITS ETF", "STU", "EUR", "ETF"), providerAsset("VUAA.DE", "Vanguard S&P 500 UCITS ETF", "XETRA", "EUR", "ETF")];
        if (symbol === "ONON") return [providerAsset("ONON", "On Holding AG", "NYSE", "USD")];
        return [];
      },
      getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [],
    });

    const initial = await buildPortfolioImportPreview(fakeSupabase(), user, { fileName: "revolut-brokerage.csv", buffer: fixture });
    expect(initial.rows.find((row) => row.symbol === "STX")).toMatchObject({ status: "ERROR", assetResolution: { reason: "PROVIDER_ERROR" } });

    calls.length = 0;
    firstAttempt = false;
    const retried = await buildPortfolioImportPreview(fakeSupabase(true), user, { fileName: "revolut-brokerage.csv", buffer: fixture, importId: initial.importId, retrySourceRow: 8 });

    expect(calls).toEqual(["STX"]);
    expect(retried.rows.find((row) => row.symbol === "STX")).toMatchObject({ status: "READY", assetResolution: { reason: "PROVIDER_SEARCH", requiresReview: false } });
    expect(retried.rows.find((row) => row.symbol === "ONON")?.status).toBe(initial.rows.find((row) => row.symbol === "ONON")?.status);
    expect(retried.rows.find((row) => row.symbol === "VUAA")?.assetResolution?.reason).toBe("AMBIGUOUS");
  });
});

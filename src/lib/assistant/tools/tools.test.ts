import { describe, expect, it } from "vitest";
import type { PortfolioSummary } from "../../portfolio/types";
import type { AssistantToolContext } from "../types";
import type { MarketDataProvider } from "../../market-data/provider";
import { executeAssistantTool } from "./registry";
import { compareAssetsTool, getAssetValuationTool, runAssetScenarioTool } from "./assets";
import { getInvestmentThesisTool } from "./portfolio";

const provenance = { source: "FMP", sourceEndpoint: "test", timestamp: "2026-10-01T00:00:00.000Z", asOfDate: "2026-10-01", dataKind: "EOD" as const, freshness: "FRESH" as const };

function context(provider?: MarketDataProvider): AssistantToolContext {
  return { supabase: {} as AssistantToolContext["supabase"], user: { id: "user-a" } as AssistantToolContext["user"], preferences: { baseCurrency: "EUR", analysisDepth: "DETAILED" }, provider, memo: new Map() };
}

describe("investment tools", () => {
  it("rejects tool execution without an authenticated user", async () => {
    const result = await executeAssistantTool("getPortfolioSummary", {}, undefined as never);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("AUTH_REQUIRED");
  });

  it("runs an asset scenario through the existing scenario engine", async () => {
    const summary: PortfolioSummary = { baseCurrency: "EUR", investedCost: 1000, currentValue: 1000, pnl: 0, performance: 0, dailyChange: 0, dataQuality: "COMPLETE", positions: [{ assetId: "asset-1", symbol: "NVDA", name: "NVIDIA", quantity: 1, averagePrice: 500, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 500, realizedPnl: 0, currentPrice: 500, currentValue: 500, unrealizedPnl: 0, unrealizedPnlPercent: 0, weight: 0.5 }] };
    const valuation = { summary, errors: [], quotes: new Map(), fxRates: [], portfolio: {}, transactions: [] };
    const toolContext = context();
    toolContext.memo.set("portfolio:valuation", Promise.resolve(valuation));
    const result = await runAssetScenarioTool.execute({ symbol: "NVDA", changePercent: -20 }, toolContext);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ symbol: "NVDA", absoluteImpact: -100, estimatedPortfolioValue: 900, positionWeight: 0.5 });
  });

  it("represents unavailable valuation data as missing instead of zero", async () => {
    const emptyProvider: MarketDataProvider = { searchAssets: async () => [], getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [] };
    const result = await getAssetValuationTool.execute({ symbol: "NVDA" }, context(emptyProvider));
    expect(result.success).toBe(true);
    expect(result.data?.valuation.metrics.every((metric) => metric.current === null)).toBe(true);
    expect(result.missingData).toContain("NVDA: valuation cannot be calculated without key metrics");
  });

  it("compares structured metrics without producing a winner or score", async () => {
    const comparisonProvider: MarketDataProvider = {
      searchAssets: async () => [],
      getQuote: async (symbol) => ({ symbol, price: 100, currency: "USD", change1D: 1, change1DPercent: 0.01, marketCap: symbol === "NVDA" ? 1000 : 500, volume: null, yearHigh: 120, yearLow: 50, provenance }),
      getHistoricalPrices: async () => [],
      getCompanyProfile: async (symbol) => ({ symbol, name: symbol, description: null, website: null, country: "US", sector: "Technology", industry: null, employees: null, provenance }),
      getFinancials: async (symbol) => [{ symbol, period: "FY", periodEnd: "2026-01-01", reportedCurrency: "USD", revenue: 100, grossProfit: 50, operatingIncome: 20, netIncome: 10, eps: 1, operatingCashFlow: 20, freeCashFlow: 15, totalDebt: 10, cash: 30, provenance }],
      getKeyMetrics: async (symbol) => [{ symbol, period: "FY", periodEnd: "2026-01-01", marketCap: symbol === "NVDA" ? 1000 : 500, pe: 30, forwardPe: symbol === "NVDA" ? 25 : 18, peg: null, priceToSales: 10, evToEbitda: null, grossMargin: 0.5, operatingMargin: 0.2, netMargin: 0.1, debtToEquity: null, revenueGrowth: symbol === "NVDA" ? 0.4 : 0.2, fcfYield: null, roic: null, roe: null, provenance }],
    };
    const result = await compareAssetsTool.execute({ symbols: ["NVDA", "MRVL"] }, context(comparisonProvider));
    expect(result.success).toBe(true);
    expect(result.data?.metrics.map((metric) => metric.metric)).toContain("Forward P/E");
    expect(result.data).not.toHaveProperty("winner");
    expect(result.data).not.toHaveProperty("score");
  });

  it("passes the authenticated user id into personal thesis queries", async () => {
    const calls: Array<{ field: string; value: string }> = [];
    const chain = {
      select() { return this; },
      eq(field: string, value: string) { calls.push({ field, value }); return this; },
      order() { return Promise.resolve({ data: [], error: null }); },
    };
    const toolContext = context();
    toolContext.supabase = { from: () => chain } as unknown as AssistantToolContext["supabase"];
    const result = await getInvestmentThesisTool.execute({}, toolContext);
    expect(result.success).toBe(true);
    expect(calls).toContainEqual({ field: "user_id", value: "user-a" });
  });
});

import { describe, expect, it } from "vitest";
import type { Asset } from "../market-data/models";
import type { MarketDataProvider } from "../market-data/provider";
import type { PortfolioSummary } from "../portfolio/types";
import type { AssistantToolContext } from "./types";
import { analyzeAssistantQuery } from "./analyzer";

const provenance = { source: "FMP", sourceEndpoint: "search", timestamp: "2026-10-01T00:00:00.000Z", asOfDate: "2026-10-01", dataKind: "EOD" as const, freshness: "FRESH" as const };
const nvda: Asset = { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", exchangeName: "NASDAQ", currency: "USD", assetType: "STOCK", country: "US", sector: "Technology", industry: "Semiconductors", logoUrl: null, provenance };

const provider: MarketDataProvider = { searchAssets: async () => [nvda], getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [] };

describe("deterministic assistant analyzer", () => {
  it("routes, resolves and executes the NVIDIA -20% scenario", async () => {
    const summary: PortfolioSummary = { baseCurrency: "EUR", investedCost: 1000, currentValue: 1000, pnl: 0, performance: 0, dailyChange: 0, dataQuality: "COMPLETE", positions: [{ assetId: "asset-1", symbol: "NVDA", name: "NVIDIA", quantity: 1, averagePrice: 500, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 500, realizedPnl: 0, currentPrice: 500, currentValue: 500, unrealizedPnl: 0, unrealizedPnlPercent: 0, weight: 0.5 }] };
    const context: AssistantToolContext = { supabase: {} as AssistantToolContext["supabase"], user: { id: "user-a" } as AssistantToolContext["user"], preferences: { baseCurrency: "EUR", analysisDepth: "QUICK" }, provider, memo: new Map() };
    context.memo.set("portfolio:valuation", Promise.resolve({ summary, errors: [], quotes: new Map(), fxRates: [], portfolio: {}, transactions: [] }));
    const result = await analyzeAssistantQuery({ query: "What if NVIDIA falls 20%?", context, debug: true });
    expect(result.intent).toBe("SCENARIO");
    expect(result.debug?.entities[0]?.symbol).toBe("NVDA");
    expect(result.debug?.queryPlan.steps).toEqual([{ tool: "runAssetScenario", input: { symbol: "NVDA", changePercent: -20 } }]);
    expect(result.scenarios[0]).toMatchObject({ label: "NVDA -20%", absoluteImpact: -100, percentageImpact: -0.1 });
  });
});

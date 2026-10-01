import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { prepareAssistantTurn, structuredDataFromToolExecutions } from "./conversation-runtime";
import type { AssistantToolContext, ToolResult } from "./types";

function context(): AssistantToolContext {
  const provider = {
    searchAssets: async (query: string) => [{ symbol: query.toLowerCase().includes("nvidia") || query.toUpperCase() === "NVDA" ? "NVDA" : "MRVL", name: query.toLowerCase().includes("nvidia") ? "NVIDIA" : "Marvell Technology", exchange: "NASDAQ", exchangeName: null, isin: null, currency: "USD" as const, assetType: "STOCK" as const, country: "US", sector: "Technology", industry: null, logoUrl: null, provenance: { source: "test", sourceEndpoint: "test", timestamp: new Date().toISOString(), asOfDate: null, dataKind: "UNKNOWN" as const, freshness: "UNKNOWN" as const } }],
    getQuote: async () => { throw new Error("unused"); },
    getHistoricalPrices: async () => [],
    getCompanyProfile: async () => { throw new Error("unused"); },
    getFinancials: async () => [],
    getKeyMetrics: async () => [],
  };
  return { supabase: {} as AssistantToolContext["supabase"], user: { id: "user-a" } as User, preferences: { baseCurrency: "EUR", analysisDepth: "DETAILED" }, provider, memo: new Map() };
}

describe("conversational assistant runtime", () => {
  it("prepares decision support with personal position and risk context", async () => {
    const turn = await prepareAssistantTurn("Should I add more NVIDIA?", { symbols: [], previousIntent: null }, context());
    expect(turn.detection.intent).toBe("POSITION_ANALYSIS");
    expect(turn.entities[0]?.symbol).toBe("NVDA");
    expect(turn.allowedToolNames).toEqual(expect.arrayContaining(["getPosition", "getPortfolioHealth", "getAssetGrowth", "getAssetValuation", "getAssetRisks"]));
  });

  it("builds source-backed structured cards without an LLM-generated UI schema", () => {
    const result: ToolResult<unknown> = { success: true, data: { symbol: "NVDA", changePercent: -20, currentPortfolioValue: 1000, estimatedPortfolioValue: 900, absoluteImpact: -100, percentageImpact: -0.1, assumptions: ["Mechanical scenario"] }, provenance: [{ source: "Calculated", label: "Existing scenario engine", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" }], generatedAt: new Date().toISOString(), missingData: [] };
    const turn = { detection: { intent: "SCENARIO" as const, confidence: "HIGH" as const, matchedTerms: ["falls"] }, entities: [{ input: "NVIDIA", symbol: "NVDA", name: "NVIDIA", ambiguous: false, candidates: [], reason: "EXACT_NAME" as const }], plan: { query: "", intent: "SCENARIO" as const, entities: [], steps: [], parameters: {} }, allowedToolNames: [], instructionsContext: null };
    const structured = structuredDataFromToolExecutions([{ name: "runAssetScenario", input: { symbol: "NVDA", changePercent: -20 }, result }], { symbols: [], previousIntent: null }, turn);
    expect(structured.structuredData.cards[0]).toMatchObject({ type: "scenario", title: "Scenario" });
    expect(structured.provenance[0].source).toBe("Calculated");
  });
});

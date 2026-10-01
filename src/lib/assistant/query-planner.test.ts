import { describe, expect, it } from "vitest";
import { buildAssistantQueryPlan } from "./query-planner";

describe("assistant query planning", () => {
  it("builds the required NVIDIA scenario plan", () => {
    const plan = buildAssistantQueryPlan("What if NVIDIA falls 20%?", {
      entities: [{ input: "NVIDIA", symbol: "NVDA", name: "NVIDIA Corporation", ambiguous: false, candidates: [], reason: "EXACT_NAME" }],
    });
    expect(plan.intent).toBe("SCENARIO");
    expect(plan.parameters.changePercent).toBe(-20);
    expect(plan.steps).toEqual([{ tool: "runAssetScenario", input: { symbol: "NVDA", changePercent: -20 } }]);
  });

  it("selects the detailed position analysis tools", () => {
    const plan = buildAssistantQueryPlan("Analyse NVIDIA dans mon portefeuille", {
      intent: "POSITION_ANALYSIS",
      entities: [{ input: "NVIDIA", symbol: "NVDA", name: "NVIDIA Corporation", ambiguous: false, candidates: [], reason: "EXACT_NAME" }],
    });
    expect(plan.steps.map((step) => step.tool)).toEqual(["getPosition", "getPortfolioHealth", "getAssetOverview", "getAssetFundamentals", "getAssetGrowth", "getAssetValuation", "getAssetRisks", "getInvestmentThesis"]);
  });
});

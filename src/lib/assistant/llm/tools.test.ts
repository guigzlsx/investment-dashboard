import { describe, expect, it } from "vitest";
import { getLLMToolDefinitions, toOpenAIFunctionTools } from "./tools";
import type { AssistantToolName } from "../types";

const allTools: AssistantToolName[] = ["getPortfolioSummary", "getPositions", "getPosition", "getPortfolioHealth", "getPortfolioExposures", "getPerformanceAttribution", "getWatchlist", "getAssetOverview", "getAssetFundamentals", "getAssetGrowth", "getAssetValuation", "getAssetRisks", "getInvestmentThesis", "compareAssets", "runAssetScenario", "runMultiAssetScenario", "runFxScenario"];

describe("OpenAI investment tool definitions", () => {
  it("exposes all deterministic tools with strict closed schemas", () => {
    const tools = toOpenAIFunctionTools(getLLMToolDefinitions(allTools));
    expect(tools).toHaveLength(17);
    expect(tools.every((tool) => tool.type === "function" && tool.strict === true)).toBe(true);
    expect(tools.every((tool) => tool.parameters?.additionalProperties === false)).toBe(true);
    expect(tools.find((tool) => tool.name === "runAssetScenario")?.parameters).toMatchObject({ required: ["symbol", "changePercent"] });
  });
});


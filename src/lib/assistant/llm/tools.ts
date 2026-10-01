import type { FunctionTool } from "openai/resources/responses/responses";
import { investmentToolRegistry } from "../tools/registry";
import type { AssistantToolName } from "../types";
import type { LLMToolDefinition } from "./types";

const noInput = { type: "object", properties: {}, required: [], additionalProperties: false };
const symbolInput = { type: "object", properties: { symbol: { type: "string", description: "A ticker symbol such as NVDA" } }, required: ["symbol"], additionalProperties: false };

const parametersByTool: Record<AssistantToolName, Record<string, unknown>> = {
  getPortfolioSummary: noInput,
  getPositions: noInput,
  getPosition: symbolInput,
  getPortfolioHealth: noInput,
  getPortfolioExposures: noInput,
  getPerformanceAttribution: { type: "object", properties: { period: { type: ["string", "null"], enum: ["1D", "1W", "1M", null], description: "Attribution period" } }, required: ["period"], additionalProperties: false },
  getWatchlist: noInput,
  getAssetOverview: symbolInput,
  getAssetFundamentals: symbolInput,
  getAssetGrowth: symbolInput,
  getAssetValuation: symbolInput,
  getAssetRisks: symbolInput,
  getInvestmentThesis: { type: "object", properties: { symbol: { type: ["string", "null"], description: "Optional ticker symbol" } }, required: ["symbol"], additionalProperties: false },
  compareAssets: { type: "object", properties: { symbols: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5, description: "Two to five ticker symbols" } }, required: ["symbols"], additionalProperties: false },
  runAssetScenario: { type: "object", properties: { symbol: { type: "string" }, changePercent: { type: "number", description: "Percentage move, for example -20" } }, required: ["symbol", "changePercent"], additionalProperties: false },
  runMultiAssetScenario: { type: "object", properties: { changes: { type: "array", minItems: 1, maxItems: 10, items: { type: "object", properties: { symbol: { type: "string" }, changePercent: { type: "number" } }, required: ["symbol", "changePercent"], additionalProperties: false } } }, required: ["changes"], additionalProperties: false },
  runFxScenario: { type: "object", properties: { currency: { type: "string", enum: ["EUR", "USD", "CHF", "GBP"] }, changePercent: { type: "number" } }, required: ["currency", "changePercent"], additionalProperties: false },
};

export function selectedToolNames(names: AssistantToolName[]) {
  return [...new Set(names)];
}

export function getLLMToolDefinitions(names: AssistantToolName[]): LLMToolDefinition[] {
  return selectedToolNames(names).map((name) => ({ name, description: investmentToolRegistry[name].description, parameters: parametersByTool[name] }));
}

export function toOpenAIFunctionTools(tools: LLMToolDefinition[]): FunctionTool[] {
  return tools.map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters, strict: true }));
}


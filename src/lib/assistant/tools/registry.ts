import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../../supabase/database.types";
import { InputValidationError } from "../../validation/inputs";
import { failureResult } from "./helpers";
import type { AssistantPreferences, AssistantToolContext, AssistantToolDefinition, AssistantToolName, ToolResult } from "../types";
import {
  compareAssetsTool,
  getAssetFundamentalsTool,
  getAssetGrowthTool,
  getAssetOverviewTool,
  getAssetRisksTool,
  getAssetValuationTool,
  runAssetScenarioTool,
  runFxScenarioTool,
  runMultiAssetScenarioTool,
} from "./assets";
import {
  getInvestmentThesisTool,
  getPerformanceAttributionTool,
  getPortfolioExposuresTool,
  getPortfolioHealthTool,
  getPortfolioSummaryTool,
  getPositionTool,
  getPositionsTool,
  getWatchlistTool,
} from "./portfolio";

export const investmentToolRegistry = {
  getPortfolioSummary: getPortfolioSummaryTool,
  getPositions: getPositionsTool,
  getPosition: getPositionTool,
  getPortfolioHealth: getPortfolioHealthTool,
  getPortfolioExposures: getPortfolioExposuresTool,
  getPerformanceAttribution: getPerformanceAttributionTool,
  getWatchlist: getWatchlistTool,
  getAssetOverview: getAssetOverviewTool,
  getAssetFundamentals: getAssetFundamentalsTool,
  getAssetGrowth: getAssetGrowthTool,
  getAssetValuation: getAssetValuationTool,
  getAssetRisks: getAssetRisksTool,
  getInvestmentThesis: getInvestmentThesisTool,
  compareAssets: compareAssetsTool,
  runAssetScenario: runAssetScenarioTool,
  runMultiAssetScenario: runMultiAssetScenarioTool,
  runFxScenario: runFxScenarioTool,
} satisfies Record<AssistantToolName, AssistantToolDefinition<unknown, unknown>>;

export type InvestmentToolRegistry = typeof investmentToolRegistry;

export function createAssistantToolContext(
  supabase: SupabaseClient<Database>,
  user: User,
  preferences: AssistantPreferences,
): AssistantToolContext {
  return { supabase, user, preferences, memo: new Map() };
}

export async function executeAssistantTool<Name extends AssistantToolName>(name: Name, input: unknown, context: AssistantToolContext): Promise<ToolResult<unknown>> {
  if (!context?.user?.id || !context.supabase) return failureResult("AUTH_REQUIRED", "An authenticated user is required to use investment tools");
  const tool = investmentToolRegistry[name] as AssistantToolDefinition<unknown, unknown> | undefined;
  if (!tool) return failureResult("TOOL_NOT_FOUND", `Unknown investment tool: ${name}`);
  try {
    return await tool.execute(input, context);
  } catch (error) {
    if (error instanceof InputValidationError) return failureResult("INVALID_INPUT", error.message);
    return failureResult("TOOL_ERROR", error instanceof Error ? error.message : "Investment tool failed");
  }
}

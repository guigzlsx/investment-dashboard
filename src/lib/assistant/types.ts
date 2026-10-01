import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { MarketDataProvider } from "../market-data/provider";

export type AssistantIntent =
  | "PORTFOLIO_OVERVIEW"
  | "PORTFOLIO_RISK"
  | "POSITION_ANALYSIS"
  | "ASSET_ANALYSIS"
  | "WATCHLIST_ANALYSIS"
  | "COMPARISON"
  | "SCENARIO"
  | "PERFORMANCE"
  | "VALUATION"
  | "GROWTH"
  | "INVESTMENT_THESIS"
  | "EDUCATION"
  | "UNKNOWN";

export type AssistantToolName =
  | "getPortfolioSummary"
  | "getPositions"
  | "getPosition"
  | "getPortfolioHealth"
  | "getPortfolioExposures"
  | "getPerformanceAttribution"
  | "getWatchlist"
  | "getAssetOverview"
  | "getAssetFundamentals"
  | "getAssetGrowth"
  | "getAssetValuation"
  | "getAssetRisks"
  | "getInvestmentThesis"
  | "compareAssets"
  | "runAssetScenario"
  | "runMultiAssetScenario"
  | "runFxScenario";

export type AssistantSource = "FMP" | "ECB" | "Your Portfolio" | "Calculated";
export type AssistantFreshness = "FRESH" | "STALE" | "UNKNOWN" | "CURRENT";

export interface AssistantProvenance {
  source: AssistantSource;
  label?: string;
  endpoint?: string;
  asOfDate: string | null;
  retrievedAt: string;
  freshness: AssistantFreshness;
}

export interface ToolError {
  code: string;
  message: string;
}

export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: ToolError;
  provenance: AssistantProvenance[];
  generatedAt: string;
  missingData: string[];
}

export interface ToolInputProperty {
  type: "string" | "number" | "array" | "object";
  description: string;
  required?: boolean;
}

export interface AssistantToolDefinition<Input, Output> {
  name: AssistantToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolInputProperty>;
    required: string[];
  };
  execute(input: Input, context: AssistantToolContext): Promise<ToolResult<Output>>;
}

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface AssistantPreferences {
  baseCurrency: string;
  analysisDepth: "QUICK" | "DETAILED";
}

export interface AssistantToolContext {
  supabase: TypedSupabaseClient;
  user: User;
  preferences: AssistantPreferences;
  provider?: MarketDataProvider;
  memo: Map<string, Promise<unknown>>;
}

export interface ResolvedEntity {
  input: string;
  symbol: string | null;
  name: string | null;
  ambiguous: boolean;
  candidates: Array<{ symbol: string; name: string; exchange: string | null }>;
  reason: "EXACT_SYMBOL" | "EXACT_NAME" | "TOP_SEARCH_RESULT" | "AMBIGUOUS" | "NOT_FOUND";
}

export interface IntentDetection {
  intent: AssistantIntent;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  matchedTerms: string[];
}

export interface QueryPlanStep {
  tool: AssistantToolName;
  input: Record<string, unknown>;
}

export interface AssistantQueryPlan {
  query: string;
  intent: AssistantIntent;
  entities: ResolvedEntity[];
  steps: QueryPlanStep[];
  parameters: Record<string, string | number | string[] | null>;
}

export interface AssistantMetric {
  label: string;
  value: number | string | null;
  unit?: string;
  source?: AssistantSource;
}

export interface AssistantObservation {
  title: string;
  rule: string;
  evidence: Array<{ label: string; value: string | number | null }>;
  values: Record<string, string | number | null>;
  severity?: "INFO" | "MEDIUM" | "HIGH";
}

export interface AssistantEvidence {
  label: string;
  value: string | number | null;
  provenance: AssistantProvenance[];
}

export interface AssistantScenario {
  label: string;
  baselineValue: number | null;
  estimatedValue: number | null;
  absoluteImpact: number | null;
  percentageImpact: number | null;
  positionWeight?: number | null;
  assumptions: string[];
}

export interface AssistantDebug {
  intent: IntentDetection;
  entities: ResolvedEntity[];
  queryPlan: AssistantQueryPlan;
  toolsCalled: Array<{ name: AssistantToolName; success: boolean; latencyMs: number; missingData: string[] }>;
  latencyMs: number;
}

export interface AssistantAnalysis {
  success: boolean;
  query: string;
  intent: AssistantIntent;
  subject: string | null;
  summaryMetrics: AssistantMetric[];
  observations: AssistantObservation[];
  risks: AssistantObservation[];
  scenarios: AssistantScenario[];
  evidence: AssistantEvidence[];
  missingData: string[];
  suggestedFollowUps: string[];
  generatedAt: string;
  debug?: AssistantDebug;
}

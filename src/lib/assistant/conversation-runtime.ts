import { conversationalEntityQueries, conversationalIntent } from "./conversation-context";
import type { AssistantConversationState } from "./conversation-service";
import { educationReference } from "./education";
import { buildAssistantQueryPlan } from "./query-planner";
import { resolveEntities } from "./entity-resolution";
import { selectedToolNames, getLLMToolDefinitions } from "./llm/tools";
import type { LLMToolExecution } from "./llm/types";
import { uniqueProvenance } from "./provenance";
import type { AssistantAnalysis, AssistantQueryPlan, AssistantToolContext, AssistantToolName, ResolvedEntity } from "./types";

export interface PreparedAssistantTurn {
  detection: ReturnType<typeof conversationalIntent>;
  entities: ResolvedEntity[];
  plan: AssistantQueryPlan;
  allowedToolNames: AssistantToolName[];
  instructionsContext: string | null;
}

export async function prepareAssistantTurn(query: string, state: AssistantConversationState, context: AssistantToolContext): Promise<PreparedAssistantTurn> {
  const detection = conversationalIntent(query, state);
  const inputs = conversationalEntityQueries(query, detection.intent, state);
  const entities = await resolveEntities(inputs, context);
  const plan = buildAssistantQueryPlan(query, { detection, entities });
  const allowedToolNames = selectedToolNames(plan.steps.map((step) => step.tool));
  return { detection, entities, plan, allowedToolNames, instructionsContext: detection.intent === "EDUCATION" ? educationReference(query) : null };
}

export function toolDefinitionsForTurn(turn: PreparedAssistantTurn) {
  return getLLMToolDefinitions(turn.allowedToolNames);
}

export interface AssistantCard {
  type: "portfolioSummary" | "position" | "scenario" | "comparison" | "risk";
  title: string;
  data: unknown;
}

export interface AssistantStructuredData {
  cards: AssistantCard[];
  conversationState: { symbols: string[]; previousIntent: string };
  toolsCalled: string[];
}

export function structuredDataFromToolExecutions(executions: LLMToolExecution[], previousState: AssistantConversationState, turn: PreparedAssistantTurn): { structuredData: AssistantStructuredData; provenance: ReturnType<typeof uniqueProvenance> } {
  const cards: AssistantCard[] = [];
  const symbols = [...new Set([...previousState.symbols, ...turn.entities.flatMap((entity) => entity.symbol ? [entity.symbol] : [])])].slice(-8);
  const add = (type: AssistantCard["type"], title: string, data: unknown) => cards.push({ type, title, data });
  for (const execution of executions) {
    if (!execution.result.success) continue;
    if (execution.name === "getPortfolioSummary") add("portfolioSummary", "Portfolio summary", execution.result.data);
    if (execution.name === "getPosition" && execution.result.data) add("position", "Position", execution.result.data);
    if (execution.name === "runAssetScenario") add("scenario", "Scenario", execution.result.data);
    if (execution.name === "runMultiAssetScenario" || execution.name === "runFxScenario") add("scenario", "Scenario", execution.result.data);
    if (execution.name === "compareAssets") add("comparison", "Comparison", execution.result.data);
    if (execution.name === "getPortfolioHealth" || execution.name === "getAssetRisks") add("risk", "Structured risks", execution.result.data);
  }
  return {
    structuredData: { cards, conversationState: { symbols, previousIntent: turn.detection.intent }, toolsCalled: executions.map((execution) => execution.name) },
    provenance: uniqueProvenance(executions.flatMap((execution) => execution.result.provenance)),
  };
}

export function structuredAnalysisFromTools(executions: LLMToolExecution[]): AssistantAnalysis | null {
  const scenario = executions.find((execution) => execution.name === "runAssetScenario" && execution.result.success)?.result.data as { symbol?: string; currentPortfolioValue?: number | null; estimatedPortfolioValue?: number | null; absoluteImpact?: number | null; percentageImpact?: number | null; positionWeight?: number | null; assumptions?: string[] } | undefined;
  if (!scenario) return null;
  return {
    success: true,
    query: "",
    intent: "SCENARIO",
    subject: scenario.symbol ?? null,
    summaryMetrics: [],
    observations: [],
    risks: [],
    scenarios: [{ label: scenario.symbol ?? "Scenario", baselineValue: scenario.currentPortfolioValue ?? null, estimatedValue: scenario.estimatedPortfolioValue ?? null, absoluteImpact: scenario.absoluteImpact ?? null, percentageImpact: scenario.percentageImpact ?? null, positionWeight: scenario.positionWeight ?? null, assumptions: scenario.assumptions ?? [] }],
    evidence: [],
    missingData: executions.flatMap((execution) => execution.result.missingData),
    suggestedFollowUps: [],
    generatedAt: new Date().toISOString(),
  };
}

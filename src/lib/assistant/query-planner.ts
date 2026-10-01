import { extractEntityQueries, extractScenarioChange, extractScenarioCurrency, routeAssistantIntent } from "./intent-router";
import type { AssistantIntent, AssistantQueryPlan, IntentDetection, ResolvedEntity } from "./types";
import { selectAssistantTools } from "./context-selector";

export interface QueryPlanOptions {
  intent?: AssistantIntent;
  detection?: IntentDetection;
  entities?: ResolvedEntity[];
}

export function buildAssistantQueryPlan(query: string, options: QueryPlanOptions = {}): AssistantQueryPlan {
  const detection = options.detection ?? routeAssistantIntent(query);
  const intent = options.intent ?? detection.intent;
  const entities = options.entities ?? [];
  const parameters: AssistantQueryPlan["parameters"] = {
    changePercent: intent === "SCENARIO" ? extractScenarioChange(query) : null,
    currency: intent === "SCENARIO" ? extractScenarioCurrency(query) : null,
    period: /1\s*(?:day|d)/i.test(query) ? "1D" : /week|semaine|1w/i.test(query) ? "1W" : /month|mois|1m/i.test(query) ? "1M" : null,
  };
  return { query, intent, entities, steps: selectAssistantTools(intent, entities, parameters), parameters };
}

export function planAssistantQueryInputs(query: string, intent = routeAssistantIntent(query).intent) {
  return extractEntityQueries(query, intent);
}

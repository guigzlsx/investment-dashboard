import { extractEntityQueries, routeAssistantIntent } from "./intent-router";
import type { AssistantConversationState } from "./conversation-service";
import type { AssistantIntent, IntentDetection } from "./types";

export function conversationalIntent(query: string, state: AssistantConversationState): IntentDetection {
  const base = routeAssistantIntent(query);
  const normalized = query.trim().toLowerCase();
  if (base.intent === "COMPARISON" && /\b(them|both|the two|les deux|eux|elles)\b/i.test(normalized) && state.symbols.length >= 2) {
    return { intent: "COMPARISON", confidence: "HIGH", matchedTerms: [...base.matchedTerms, "conversation subjects"] };
  }
  if (base.intent === "UNKNOWN" && /\b(what about|how about|et |and |qu'en est-il|qu’en est-il)\b/i.test(normalized)) {
    return { intent: "ASSET_ANALYSIS", confidence: "MEDIUM", matchedTerms: ["conversation follow-up"] };
  }
  if (base.intent === "UNKNOWN" && /\b(should i|add more|reinforce|renforcer|buy more|acheter davantage|invest more|investir)\b/i.test(normalized)) {
    return { intent: "POSITION_ANALYSIS", confidence: "MEDIUM", matchedTerms: ["decision support"] };
  }
  if (base.intent === "UNKNOWN" && state.previousIntent && /\b(it|this|that|the other|lui|elle|ça|cela)\b/i.test(normalized)) {
    return { intent: state.previousIntent, confidence: "MEDIUM", matchedTerms: ["conversation reference"] };
  }
  return base;
}

export function conversationalEntityQueries(query: string, intent: AssistantIntent, state: AssistantConversationState) {
  const normalized = query.trim().toLowerCase();
  if (intent === "COMPARISON" && /\b(them|both|the two|les deux|eux|elles)\b/i.test(normalized) && state.symbols.length >= 2) return state.symbols;
  return extractEntityQueries(query, intent);
}


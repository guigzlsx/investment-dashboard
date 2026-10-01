import type { AssistantIntent, IntentDetection } from "./types";

function includesAny(value: string, terms: string[]) {
  return terms.filter((term) => value.includes(term));
}

export function routeAssistantIntent(query: string): IntentDetection {
  const normalized = query.trim().toLowerCase();
  const portfolioTerms = includesAny(normalized, ["portfolio", "portefeuille", "holdings", "positions", "mes actifs"]);
  const riskTerms = includesAny(normalized, ["risk", "risks", "risque", "risques", "expos", "concentr", "diversif", "theme", "thématique", "sector", "secteur", "currency", "devise"]);
  const scenarioTerms = includesAny(normalized, ["what if", "si ", "falls", "fall ", "baisse", "baiss", "hausse", "rises", "drop", "scenario", "scénario"]);
  const comparisonTerms = includesAny(normalized, ["compare", "compar", "versus", " vs ", "side by side", "côte à côte"]);
  const educationTerms = includesAny(normalized, ["what is", "what's", "define", "explain", "qu'est-ce", "c'est quoi", "définition"]);
  const watchlistTerms = includesAny(normalized, ["watchlist", "watch list", "liste de suivi"]);
  const decisionTerms = includesAny(normalized, ["should i", "add more", "reinforce", "renforcer", "buy more", "acheter davantage", "invest more", "investir"]);

  if (educationTerms.length) return { intent: "EDUCATION", confidence: "HIGH", matchedTerms: educationTerms };
  if (comparisonTerms.length) return { intent: "COMPARISON", confidence: "HIGH", matchedTerms: comparisonTerms };
  if (scenarioTerms.length) return { intent: "SCENARIO", confidence: "HIGH", matchedTerms: scenarioTerms };
  if (watchlistTerms.length) return { intent: "WATCHLIST_ANALYSIS", confidence: "HIGH", matchedTerms: watchlistTerms };
  if (riskTerms.length && (portfolioTerms.length || /\b(my|mon|ma|mes|your|ton|ta|tes)\b/i.test(normalized))) return { intent: "PORTFOLIO_RISK", confidence: "HIGH", matchedTerms: [...portfolioTerms, ...riskTerms] };
  if (includesAny(normalized, ["performance", "attribution", "moved my portfolio", "évolution", "rendement"]).length && portfolioTerms.length) return { intent: "PERFORMANCE", confidence: "HIGH", matchedTerms: [...portfolioTerms, ...includesAny(normalized, ["performance", "attribution", "moved my portfolio", "évolution", "rendement"])] };
  if (includesAny(normalized, ["valuation", "valorisation", "p/e", "pe", "forward p/e", "price/sales"]).length) return { intent: "VALUATION", confidence: "HIGH", matchedTerms: includesAny(normalized, ["valuation", "valorisation", "p/e", "pe", "forward p/e", "price/sales"]) };
  if (includesAny(normalized, ["growth", "croissance", "revenue", "revenu", "eps growth"]).length) return { intent: "GROWTH", confidence: "HIGH", matchedTerms: includesAny(normalized, ["growth", "croissance", "revenue", "revenu", "eps growth"]) };
  if (includesAny(normalized, ["thesis", "thèse", "investment case", "conviction"]).length) return { intent: "INVESTMENT_THESIS", confidence: "HIGH", matchedTerms: includesAny(normalized, ["thesis", "thèse", "investment case", "conviction"]) };
  if (portfolioTerms.length && includesAny(normalized, ["in my portfolio", "dans mon portefeuille", "my position", "ma position"]).length) return { intent: "POSITION_ANALYSIS", confidence: "HIGH", matchedTerms: portfolioTerms };
  if (portfolioTerms.length && includesAny(normalized, ["analy", "overview", "summary", "résumé", "montre", "show", "review", "analyse"]).length) return { intent: "PORTFOLIO_OVERVIEW", confidence: "HIGH", matchedTerms: portfolioTerms };
  if (portfolioTerms.length && riskTerms.length) return { intent: "PORTFOLIO_RISK", confidence: "MEDIUM", matchedTerms: [...portfolioTerms, ...riskTerms] };
  if (decisionTerms.length) return { intent: "POSITION_ANALYSIS", confidence: "MEDIUM", matchedTerms: decisionTerms };
  if (includesAny(normalized, ["analy", "analyse", "company", "entreprise", "asset", "action", "stock", "fiche"]).length) return { intent: "ASSET_ANALYSIS", confidence: "MEDIUM", matchedTerms: includesAny(normalized, ["analy", "analyse", "company", "entreprise", "asset", "action", "stock", "fiche"]) };
  if (portfolioTerms.length) return { intent: "PORTFOLIO_OVERVIEW", confidence: "MEDIUM", matchedTerms: portfolioTerms };
  return { intent: "UNKNOWN", confidence: "LOW", matchedTerms: [] };
}

export function extractScenarioChange(query: string) {
  const match = query.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (value < 0) return value;
  if (/\b(fall|falls|drop|drops|decrease|decreases|baisse|baisser|baissé)\b/i.test(query)) return -value;
  return value;
}

export function extractScenarioCurrency(query: string) {
  const match = query.toUpperCase().match(/\b(EUR|USD|CHF|GBP)\b/);
  return match?.[1] ?? null;
}

function stripEntityContext(value: string) {
  return value
    .replace(/\b(what if|what happens if|what about|how about|que se passe-t-il si|qu'en est-il|qu’en est-il|si|analyze|analyse|compare|compar(e|er)?|show me|montre-moi|look at|regarde)\b/gi, " ")
    .replace(/\b(my|mon|ma|mes|the|le|la|les|portfolio|portefeuille|position|watchlist|watch list|liste de suivi|falls?|baisse|baiss(e|er)?|drops?|rises?|hausse|should|i|add|more|reinforce|renforcer|buy|acheter|invest|investir|de|du|des|in|dans|with|avec|by|par)\b/gi, " ")
    .replace(/-?\d+(?:[.,]\d+)?\s*%/g, " ")
    .replace(/[?!.,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEntityQueries(query: string, intent: AssistantIntent) {
  const stripped = stripEntityContext(query);
  if (!stripped || intent === "PORTFOLIO_OVERVIEW" || intent === "PORTFOLIO_RISK" || intent === "WATCHLIST_ANALYSIS" || intent === "PERFORMANCE" || intent === "EDUCATION" || intent === "UNKNOWN") return [];
  if (intent === "COMPARISON") {
    const parts = stripped.split(/\s+(?:and|et|vs|versus|avec)\s+/i).map((part) => part.trim()).filter(Boolean);
    return parts.length > 1 ? parts.slice(0, 5) : [stripped];
  }
  return [stripped];
}

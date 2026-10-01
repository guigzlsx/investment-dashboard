import type { AssistantIntent, AssistantToolName, QueryPlanStep, ResolvedEntity } from "./types";

function assetSteps(tool: AssistantToolName, entities: ResolvedEntity[]) {
  return entities.filter((entity): entity is ResolvedEntity & { symbol: string } => Boolean(entity.symbol)).map((entity) => ({ tool, input: { symbol: entity.symbol } }));
}

export function selectAssistantTools(intent: AssistantIntent, entities: ResolvedEntity[], parameters: Record<string, string | number | string[] | null>): QueryPlanStep[] {
  const symbols = entities.flatMap((entity) => entity.symbol ? [entity.symbol] : []);
  switch (intent) {
    case "PORTFOLIO_OVERVIEW": return [{ tool: "getPortfolioSummary", input: {} }];
    case "PORTFOLIO_RISK": return [{ tool: "getPortfolioSummary", input: {} }, { tool: "getPortfolioHealth", input: {} }, { tool: "getPortfolioExposures", input: {} }];
    case "POSITION_ANALYSIS": return [{ tool: "getPosition", input: { symbol: symbols[0] } }, { tool: "getPortfolioHealth", input: {} }, ...assetSteps("getAssetOverview", entities), ...assetSteps("getAssetFundamentals", entities), ...assetSteps("getAssetGrowth", entities), ...assetSteps("getAssetValuation", entities), ...assetSteps("getAssetRisks", entities), ...assetSteps("getInvestmentThesis", entities)];
    case "ASSET_ANALYSIS": return [...assetSteps("getPosition", entities), ...assetSteps("getAssetOverview", entities), ...assetSteps("getAssetFundamentals", entities), ...assetSteps("getAssetGrowth", entities), ...assetSteps("getAssetValuation", entities), ...assetSteps("getAssetRisks", entities), ...assetSteps("getInvestmentThesis", entities)];
    case "WATCHLIST_ANALYSIS": return [{ tool: "getWatchlist", input: {} }];
    case "COMPARISON": return symbols.length >= 2 ? [{ tool: "compareAssets", input: { symbols } }] : [];
    case "SCENARIO": {
      const changePercent = parameters.changePercent;
      if (parameters.currency && typeof changePercent === "number") return [{ tool: "runFxScenario", input: { currency: parameters.currency, changePercent } }];
      if (symbols.length === 1 && typeof changePercent === "number") return [{ tool: "runAssetScenario", input: { symbol: symbols[0], changePercent } }];
      return [];
    }
    case "PERFORMANCE": return [{ tool: "getPerformanceAttribution", input: { period: parameters.period ?? "1D" } }];
    case "VALUATION": return assetSteps("getAssetValuation", entities);
    case "GROWTH": return assetSteps("getAssetGrowth", entities);
    case "INVESTMENT_THESIS": return [{ tool: "getInvestmentThesis", input: symbols[0] ? { symbol: symbols[0] } : {} }];
    case "EDUCATION":
    case "UNKNOWN": return [];
  }
}

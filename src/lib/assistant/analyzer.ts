import { buildAssistantQueryPlan, planAssistantQueryInputs } from "./query-planner";
import { resolveEntities } from "./entity-resolution";
import { routeAssistantIntent } from "./intent-router";
import { executeAssistantTool } from "./tools/registry";
import type { AssistantAnalysis, AssistantDebug, AssistantEvidence, AssistantMetric, AssistantObservation, AssistantQueryPlan, AssistantScenario, AssistantToolContext, AssistantToolName, IntentDetection, ResolvedEntity, ToolResult } from "./types";

function observation(title: string, rule: string, evidence: Array<{ label: string; value: string | number | null }>, values: Record<string, string | number | null>, severity: AssistantObservation["severity"] = "INFO"): AssistantObservation {
  return { title, rule, evidence, values, severity };
}

function resultFor(results: Array<{ name: AssistantToolName; input: Record<string, unknown>; result: ToolResult<unknown> }>, name: AssistantToolName, symbol?: string) {
  return results.find((item) => item.name === name && (!symbol || item.input.symbol === symbol))?.result;
}

function resultData<T>(result: ToolResult<unknown> | undefined) {
  return result?.success ? result.data as T : undefined;
}

function mergeMissing(entities: ResolvedEntity[], results: Array<{ result: ToolResult<unknown> }>) {
  const entityMissing = entities.flatMap((entity) => entity.symbol ? [] : [`Unable to resolve ${entity.input}${entity.ambiguous ? ": search returned multiple candidates" : ""}`]);
  return [...new Set([...entityMissing, ...results.flatMap((item) => item.result.missingData)])];
}

function provenanceEvidence(results: Array<{ name: AssistantToolName; result: ToolResult<unknown> }>): AssistantEvidence[] {
  const seen = new Set<string>();
  const evidence: AssistantEvidence[] = [];
  for (const item of results) {
    for (const provenance of item.result.provenance) {
      const key = `${provenance.source}:${provenance.endpoint ?? ""}:${provenance.asOfDate ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push({ label: item.name, value: provenance.label ?? provenance.source, provenance: [provenance] });
    }
  }
  return evidence;
}

function followUps(intent: AssistantAnalysis["intent"]) {
  switch (intent) {
    case "PORTFOLIO_OVERVIEW": return ["Inspect my main portfolio risks", "Show performance attribution"];
    case "PORTFOLIO_RISK": return ["Show my sector and currency exposure", "What if my largest position falls 20%?"];
    case "POSITION_ANALYSIS": return ["Show the investment thesis", "Run a -20% scenario"];
    case "ASSET_ANALYSIS": return ["Compare this asset with another company", "Show historical valuation context"];
    case "WATCHLIST_ANALYSIS": return ["Analyze one watchlist asset", "Show missing watchlist data"];
    case "COMPARISON": return ["Analyze one of these assets", "Run a portfolio scenario"];
    case "SCENARIO": return ["Show my portfolio concentration", "Explain the scenario assumptions"];
    case "PERFORMANCE": return ["Show my largest portfolio exposures", "Analyze one position"];
    case "VALUATION": return ["Show the company's growth context", "Show structured risks"];
    case "GROWTH": return ["Show valuation context", "Show the investment thesis"];
    case "INVESTMENT_THESIS": return ["Analyze the underlying asset", "Show portfolio impact"];
    case "EDUCATION": return ["Analyze my portfolio", "Explain a valuation metric for an asset"];
    case "UNKNOWN": return ["Analyze my portfolio", "Analyze an asset such as NVDA"];
  }
}

function analysisFromResults(query: string, intent: AssistantAnalysis["intent"], entities: ResolvedEntity[], plan: AssistantQueryPlan, results: Array<{ name: AssistantToolName; input: Record<string, unknown>; result: ToolResult<unknown> }>, preferences: AssistantToolContext["preferences"], startedAt: number, detection: IntentDetection, debug: boolean): AssistantAnalysis {
  const summaryMetrics: AssistantMetric[] = [];
  const observations: AssistantObservation[] = [];
  const risks: AssistantObservation[] = [];
  const scenarios: AssistantScenario[] = [];
  const summary = resultData<{ summary: { baseCurrency: string; investedCost: number | null; currentValue: number | null; pnl: number | null; performance: number | null; dailyChange: number | null; positions: Array<{ symbol: string; weight?: number | null }> }; insights: Array<{ title: string; description: string; severity: "INFO" | "MEDIUM" | "HIGH"; type: string; evidence: Array<{ label: string; value: string }> }> }>(resultFor(results, "getPortfolioSummary"));
  if (summary) {
    summaryMetrics.push({ label: "Portfolio value", value: summary.summary.currentValue, unit: summary.summary.baseCurrency, source: "Calculated" }, { label: "Invested capital", value: summary.summary.investedCost, unit: summary.summary.baseCurrency, source: "Calculated" }, { label: "P/L", value: summary.summary.pnl, unit: summary.summary.baseCurrency, source: "Calculated" }, { label: "Performance", value: summary.summary.performance, unit: "%", source: "Calculated" });
    for (const insight of summary.insights) observations.push(observation(insight.title, `PortfolioInsightEngine rule: ${insight.type}`, insight.evidence, { description: insight.description }, insight.severity));
  }

  const health = resultData<{ health: { concentration: Array<{ key: string; percent: number; symbols: string[] }>; sectors: Array<{ key: string; percent: number; symbols: string[] }>; countries: Array<{ key: string; percent: number; symbols: string[] }>; currencies: Array<{ key: string; percent: number; symbols: string[] }>; themes: Array<{ key: string; percent: number; symbols: string[] }>; notes: string[] } }>(resultFor(results, "getPortfolioHealth"));
  if (health) {
    const dimensions = [{ label: "Concentration", rows: health.health.concentration }, { label: "Sectors", rows: health.health.sectors }, { label: "Currencies", rows: health.health.currencies }, { label: "Themes", rows: health.health.themes }];
    for (const dimension of dimensions) {
      for (const row of dimension.rows.slice(0, preferences.analysisDepth === "DETAILED" ? 5 : 2)) {
        observations.push(observation(`${dimension.label}: ${row.key}`, `Exposure engine dimension ${dimension.label.toLowerCase()}`, [{ label: "Allocation", value: row.percent }, { label: "Symbols", value: row.symbols.join(", ") }], { percent: row.percent, symbols: row.symbols.join(", ") }, row.percent > 0.5 ? "MEDIUM" : "INFO"));
      }
    }
  }

  for (const entity of entities.filter((item): item is ResolvedEntity & { symbol: string } => Boolean(item.symbol))) {
    const symbol = entity.symbol;
    const position = resultData<{ symbol: string; quantity: number; currentValue?: number | null; unrealizedPnl?: number | null; weight?: number | null } | null>(resultFor(results, "getPosition", symbol));
    if (position) {
      summaryMetrics.push({ label: `${symbol} position weight`, value: position.weight ?? null, unit: "%", source: "Calculated" });
      observations.push(observation(`${symbol} is held in the portfolio`, "Position lookup matched the authenticated portfolio", [{ label: "Quantity", value: position.quantity }, { label: "Weight", value: position.weight ?? null }], { quantity: position.quantity, weight: position.weight ?? null }));
    }
    const overview = resultData<{ quote: { price: number | null; marketCap: number | null; change1DPercent: number | null; currency: string | null } | null }>(resultFor(results, "getAssetOverview", symbol));
    if (overview?.quote) summaryMetrics.push({ label: `${symbol} price`, value: overview.quote.price, unit: overview.quote.currency ?? undefined, source: "FMP" }, { label: `${symbol} 1D change`, value: overview.quote.change1DPercent, unit: "%", source: "FMP" });
    const growth = resultData<{ growth: { revenueTrend: string; epsTrend: string; freeCashFlowTrend: string; points: Array<{ revenueGrowth: number | null; epsGrowth: number | null; freeCashFlowGrowth: number | null }> } }>(resultFor(results, "getAssetGrowth", symbol));
    if (growth) {
      const last = growth.growth.points[growth.growth.points.length - 1];
      observations.push(observation(`${symbol} growth context`, "Growth engine compares the latest known growth rate with the preceding one", [{ label: "Revenue trend", value: growth.growth.revenueTrend }, { label: "EPS trend", value: growth.growth.epsTrend }, { label: "FCF trend", value: growth.growth.freeCashFlowTrend }], { revenueGrowth: last?.revenueGrowth ?? null, epsGrowth: last?.epsGrowth ?? null, freeCashFlowGrowth: last?.freeCashFlowGrowth ?? null }));
    }
    const valuation = resultData<{ valuation: { metrics: Array<{ metric: string; current: number | null; median: number | null; relativeToMedian: number | null }> } }>(resultFor(results, "getAssetValuation", symbol));
    if (valuation) {
      const visible = valuation.valuation.metrics.filter((metric) => metric.current !== null).slice(0, preferences.analysisDepth === "DETAILED" ? 5 : 2);
      for (const metric of visible) observations.push(observation(`${symbol} ${metric.metric} valuation context`, "Valuation engine compares current observations with available historical observations", [{ label: "Current", value: metric.current }, { label: "Historical median", value: metric.median }, { label: "Relative to median", value: metric.relativeToMedian }], { metric: metric.metric, current: metric.current, median: metric.median, relativeToMedian: metric.relativeToMedian }));
    }
    const assetRisks = resultData<{ risks: Array<{ category: string; available: boolean; observation: string | null; evidence: string[] }> }>(resultFor(results, "getAssetRisks", symbol));
    if (assetRisks) for (const risk of assetRisks.risks.filter((item) => item.available).slice(0, preferences.analysisDepth === "DETAILED" ? 8 : 3)) risks.push(observation(`${symbol}: ${risk.category}`, "Structured risk coverage observation", risk.evidence.map((value) => ({ label: "Evidence", value })), { observation: risk.observation }, "INFO"));
  }

  const comparison = resultData<{ symbols: string[]; metrics: Array<{ metric: string; values: Record<string, number | null>; difference: number | null; missingSymbols: string[] }> }>(resultFor(results, "compareAssets"));
  if (comparison) {
    summaryMetrics.push({ label: "Assets compared", value: comparison.symbols.length, source: "Calculated" });
    for (const metric of comparison.metrics) observations.push(observation(metric.metric, "Comparison engine shows available values without ranking", Object.entries(metric.values).map(([symbol, value]) => ({ label: symbol, value })), { difference: metric.difference, missing: metric.missingSymbols.join(", ") || null }));
  }

  const attribution = resultData<{ attribution: { period: string; totalChange: number | null; rows: Array<{ symbol: string; change: number | null }> } }>(resultFor(results, "getPerformanceAttribution"));
  if (attribution) {
    summaryMetrics.push({ label: `Attributed change (${attribution.attribution.period})`, value: attribution.attribution.totalChange, source: "Calculated" });
    for (const row of attribution.attribution.rows.slice(0, preferences.analysisDepth === "DETAILED" ? 8 : 3)) observations.push(observation(`${row.symbol} contribution`, "Attribution engine contribution for the selected period", [{ label: "Change", value: row.change }], { change: row.change }));
  }

  const scenario = resultData<{ symbol?: string; changePercent?: number; currentPortfolioValue?: number | null; estimatedPortfolioValue?: number | null; absoluteImpact?: number | null; percentageImpact?: number | null; positionWeight?: number | null; assumptions?: string[] }>(resultFor(results, "runAssetScenario"));
  if (scenario) scenarios.push({ label: `${scenario.symbol} ${scenario.changePercent}%`, baselineValue: scenario.currentPortfolioValue ?? null, estimatedValue: scenario.estimatedPortfolioValue ?? null, absoluteImpact: scenario.absoluteImpact ?? null, percentageImpact: scenario.percentageImpact ?? null, positionWeight: scenario.positionWeight ?? null, assumptions: scenario.assumptions ?? [] });
  const fxScenario = resultData<{ baselineValue: number | null; estimatedValue: number | null; impact: number | null; impactPercent: number | null; assumptions: string[] }>(resultFor(results, "runFxScenario"));
  if (fxScenario) scenarios.push({ label: "FX scenario", baselineValue: fxScenario.baselineValue, estimatedValue: fxScenario.estimatedValue, absoluteImpact: fxScenario.impact, percentageImpact: fxScenario.impactPercent, assumptions: fxScenario.assumptions });
  const multiScenario = resultData<{ result: { baselineValue: number | null; estimatedValue: number | null; impact: number | null; impactPercent: number | null; assumptions: string[] } }>(resultFor(results, "runMultiAssetScenario"));
  if (multiScenario) scenarios.push({ label: "Multi-asset scenario", baselineValue: multiScenario.result.baselineValue, estimatedValue: multiScenario.result.estimatedValue, absoluteImpact: multiScenario.result.impact, percentageImpact: multiScenario.result.impactPercent, assumptions: multiScenario.result.assumptions });

  const watchlist = resultData<{ items: Array<{ symbol: string; quote: { price: number | null } | null; metrics: unknown | null }> }>(resultFor(results, "getWatchlist"));
  if (watchlist) {
    summaryMetrics.push({ label: "Watchlist assets", value: watchlist.items.length, source: "Your Portfolio" });
    if (watchlist.items.length) observations.push(observation("Watchlist coverage", "Watchlist tool returned the user's saved assets and available market data", [{ label: "Assets", value: watchlist.items.map((item) => item.symbol).join(", ") }], { count: watchlist.items.length }));
  }

  if (intent === "EDUCATION") observations.push(observation("Education intent detected", "Lot 4A routes educational questions without generating an answer", [{ label: "Status", value: "Prepared for a future educational layer" }], { llmEnabled: "no" }));
  if (intent === "UNKNOWN") observations.push(observation("Question not mapped", "No deterministic intent rule matched this query", [{ label: "Next step", value: "Try one of the suggested questions" }], {}));

  const allResults = results.map((item) => ({ name: item.name, result: item.result }));
  const missingData = mergeMissing(entities, results);
  const successfulTools = results.filter((item) => item.result.success).length;
  const debugData: AssistantDebug = {
    intent: detection,
    entities,
    queryPlan: plan,
    toolsCalled: results.map((item) => ({ name: item.name, success: item.result.success, latencyMs: 0, missingData: item.result.missingData })),
    latencyMs: Date.now() - startedAt,
  };
  return {
    success: intent !== "UNKNOWN" && (successfulTools > 0 || intent === "EDUCATION"),
    query,
    intent,
    subject: entities.find((entity) => entity.symbol)?.symbol ?? null,
    summaryMetrics,
    observations: preferences.analysisDepth === "QUICK" ? observations.slice(0, 8) : observations,
    risks: preferences.analysisDepth === "QUICK" ? risks.slice(0, 3) : risks,
    scenarios,
    evidence: provenanceEvidence(allResults),
    missingData,
    suggestedFollowUps: followUps(intent),
    generatedAt: new Date().toISOString(),
    ...(debug ? { debug: debugData } : {}),
  };
}

export async function analyzeAssistantQuery({ query, context, debug = false }: { query: string; context: AssistantToolContext; debug?: boolean }) {
  const startedAt = Date.now();
  const detection = routeAssistantIntent(query);
  const entityInputs = planAssistantQueryInputs(query, detection.intent);
  const entities = await resolveEntities(entityInputs, context);
  const plan = buildAssistantQueryPlan(query, { detection, entities });
  const results = await Promise.all(plan.steps.map(async (step) => {
    const toolStartedAt = Date.now();
    const result = await executeAssistantTool(step.tool, step.input, context);
    return { name: step.tool, input: step.input, result, latencyMs: Date.now() - toolStartedAt };
  }));
  const positionMatch = results.some((item) => item.name === "getPosition" && item.result.success && Boolean(item.result.data));
  const finalIntent = detection.intent === "ASSET_ANALYSIS" && positionMatch ? "POSITION_ANALYSIS" : detection.intent;
  const finalPlan = finalIntent === plan.intent ? plan : { ...plan, intent: finalIntent };
  const analysis = analysisFromResults(query, finalIntent, entities, finalPlan, results, context.preferences, startedAt, detection, debug);
  if (debug && analysis.debug) analysis.debug.toolsCalled = results.map((item) => ({ name: item.name, success: item.result.success, latencyMs: item.latencyMs, missingData: item.result.missingData }));
  return analysis;
}

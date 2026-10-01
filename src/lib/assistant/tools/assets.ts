import { analyzeGrowth, analyzeRiskCoverage, analyzeValuation } from "../../analysis/fundamentals";
import type { CompanyProfile, FinancialStatement, HistoricalPrice, KeyMetrics, Quote } from "../../market-data/models";
import { calculateFxScenario, calculateScenario, type ScenarioResult } from "../../portfolio/scenarios";
import type { AssistantToolDefinition, AssistantToolContext } from "../types";
import { provenanceFromMarket } from "../provenance";
import { percentInput, symbolInput, symbolsInput } from "../tool-inputs";
import { assistantProvider, memoized, portfolioValuation, successResult } from "./helpers";

interface AssetBundle {
  profile: CompanyProfile | null;
  quote: Quote | null;
  financials: FinancialStatement[];
  metrics: KeyMetrics[];
  historicalPrices: HistoricalPrice[];
}

function symbolSchema(description = "Ticker symbol") {
  return { type: "object" as const, properties: { symbol: { type: "string" as const, description, required: true } }, required: ["symbol"] };
}

async function assetPart<T>(context: AssistantToolContext, symbol: string, part: keyof AssetBundle, loader: () => Promise<T>) {
  return memoized(context, `asset:${symbol}:${part}`, loader);
}

async function assetBundle(context: AssistantToolContext, symbol: string, options: { history?: boolean } = {}): Promise<AssetBundle> {
  const provider = assistantProvider(context);
  const [profile, quote, financials, metrics, historicalPrices] = await Promise.allSettled([
    assetPart(context, symbol, "profile", () => provider.getCompanyProfile(symbol)),
    assetPart(context, symbol, "quote", () => provider.getQuote(symbol)),
    assetPart(context, symbol, "financials", () => provider.getFinancials(symbol)),
    assetPart(context, symbol, "metrics", () => provider.getKeyMetrics(symbol)),
    options.history ? assetPart(context, symbol, "historicalPrices", () => provider.getHistoricalPrices(symbol, { limit: 370 })) : Promise.resolve([] as HistoricalPrice[]),
  ]);
  return {
    profile: profile.status === "fulfilled" ? profile.value : null,
    quote: quote.status === "fulfilled" ? quote.value : null,
    financials: financials.status === "fulfilled" ? financials.value : [],
    metrics: metrics.status === "fulfilled" ? metrics.value : [],
    historicalPrices: historicalPrices.status === "fulfilled" ? historicalPrices.value : [],
  };
}

function bundleProvenance(bundle: AssetBundle) {
  return [bundle.profile?.provenance, bundle.quote?.provenance, ...bundle.financials.map((item) => item.provenance), ...bundle.metrics.map((item) => item.provenance), ...bundle.historicalPrices.map((item) => item.provenance)].filter((value): value is NonNullable<typeof value> => Boolean(value)).map(provenanceFromMarket);
}

function bundleMissingData(symbol: string, bundle: AssetBundle, includeHistory = false) {
  const missing: string[] = [];
  if (!bundle.profile) missing.push(`${symbol}: company profile unavailable`);
  if (!bundle.quote) missing.push(`${symbol}: quote unavailable`);
  if (!bundle.financials.length) missing.push(`${symbol}: financial statements unavailable`);
  if (!bundle.metrics.length) missing.push(`${symbol}: key metrics unavailable`);
  if (includeHistory && !bundle.historicalPrices.length) missing.push(`${symbol}: historical prices unavailable`);
  return missing;
}

export interface AssetOverviewToolData {
  symbol: string;
  profile: CompanyProfile | null;
  quote: Quote | null;
  historicalPrices: HistoricalPrice[];
}

export const getAssetOverviewTool: AssistantToolDefinition<{ symbol: string }, AssetOverviewToolData> = {
  name: "getAssetOverview",
  description: "Returns a provider-backed company profile, current quote and historical observations.",
  inputSchema: symbolSchema(),
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const bundle = await assetBundle(context, symbol, { history: true });
    return successResult({ symbol, profile: bundle.profile, quote: bundle.quote, historicalPrices: bundle.historicalPrices }, bundleProvenance(bundle), bundleMissingData(symbol, bundle, true));
  },
};

export interface AssetFundamentalsToolData {
  symbol: string;
  latestFinancials: FinancialStatement | null;
  financials: FinancialStatement[];
  latestMetrics: KeyMetrics | null;
  metrics: KeyMetrics[];
}

export const getAssetFundamentalsTool: AssistantToolDefinition<{ symbol: string }, AssetFundamentalsToolData> = {
  name: "getAssetFundamentals",
  description: "Returns normalized provider financial statements and key metrics without interpretation.",
  inputSchema: symbolSchema(),
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const bundle = await assetBundle(context, symbol);
    return successResult({ symbol, latestFinancials: bundle.financials[0] ?? null, financials: bundle.financials, latestMetrics: bundle.metrics[0] ?? null, metrics: bundle.metrics }, bundleProvenance(bundle), bundleMissingData(symbol, bundle));
  },
};

export const getAssetGrowthTool: AssistantToolDefinition<{ symbol: string }, { symbol: string; growth: ReturnType<typeof analyzeGrowth> }> = {
  name: "getAssetGrowth",
  description: "Returns deterministic growth trends derived from normalized financial statements.",
  inputSchema: symbolSchema(),
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const bundle = await assetBundle(context, symbol);
    const growth = analyzeGrowth(bundle.financials);
    return successResult({ symbol, growth }, bundleProvenance(bundle), bundle.financials.length ? [] : [`${symbol}: growth cannot be calculated without financial statements`]);
  },
};

export const getAssetValuationTool: AssistantToolDefinition<{ symbol: string }, { symbol: string; valuation: ReturnType<typeof analyzeValuation> }> = {
  name: "getAssetValuation",
  description: "Returns historical provider valuation observations and derived medians, never a buy or sell verdict.",
  inputSchema: symbolSchema(),
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const bundle = await assetBundle(context, symbol);
    const valuation = analyzeValuation(bundle.metrics);
    return successResult({ symbol, valuation }, bundleProvenance(bundle), bundle.metrics.length ? [] : [`${symbol}: valuation cannot be calculated without key metrics`]);
  },
};

export const getAssetRisksTool: AssistantToolDefinition<{ symbol: string }, { symbol: string; risks: ReturnType<typeof analyzeRiskCoverage> }> = {
  name: "getAssetRisks",
  description: "Returns only structured risk observations supported by available provider data.",
  inputSchema: symbolSchema(),
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const bundle = await assetBundle(context, symbol);
    const risks = analyzeRiskCoverage(bundle.financials[0] ?? null, bundle.metrics[0] ?? null, analyzeValuation(bundle.metrics));
    return successResult({ symbol, risks }, bundleProvenance(bundle), risks.filter((risk) => !risk.available).map((risk) => `${symbol}: ${risk.category} risk data unavailable`));
  },
};

function performance52W(quote: Quote | null, history: HistoricalPrice[]) {
  if (!quote || quote.price === null) return null;
  const target = new Date();
  target.setDate(target.getDate() - 365);
  const previous = history.filter((item) => item.close !== null && new Date(item.date) <= target).sort((left, right) => right.date.localeCompare(left.date))[0];
  return previous?.close !== null && previous?.close !== undefined && previous.close !== 0 ? quote.price / previous.close - 1 : null;
}

export interface AssetComparisonMetric {
  metric: string;
  values: Record<string, number | null>;
  difference: number | null;
  missingSymbols: string[];
}

export interface AssetComparisonData {
  symbols: string[];
  metrics: AssetComparisonMetric[];
}

function comparisonValues(symbols: string[], bundles: Map<string, AssetBundle>): AssetComparisonMetric[] {
  const latest = (symbol: string) => bundles.get(symbol)?.financials[0] ?? null;
  const keyMetrics = (symbol: string) => bundles.get(symbol)?.metrics[0] ?? null;
  const growth = (symbol: string) => {
    const points = analyzeGrowth(bundles.get(symbol)?.financials ?? []).points;
    return points[points.length - 1] ?? null;
  };
  const valueRows: Array<[string, (symbol: string) => number | null]> = [
    ["Market Cap", (symbol) => keyMetrics(symbol)?.marketCap ?? bundles.get(symbol)?.quote?.marketCap ?? null],
    ["Revenue Growth", (symbol) => keyMetrics(symbol)?.revenueGrowth ?? growth(symbol)?.revenueGrowth ?? null],
    ["EPS Growth", (symbol) => growth(symbol)?.epsGrowth ?? null],
    ["Gross Margin", (symbol) => keyMetrics(symbol)?.grossMargin ?? growth(symbol)?.grossMargin ?? null],
    ["Operating Margin", (symbol) => keyMetrics(symbol)?.operatingMargin ?? growth(symbol)?.operatingMargin ?? null],
    ["Free Cash Flow", (symbol) => latest(symbol)?.freeCashFlow ?? null],
    ["Forward P/E", (symbol) => keyMetrics(symbol)?.forwardPe ?? null],
    ["Price/Sales", (symbol) => keyMetrics(symbol)?.priceToSales ?? null],
    ["Debt", (symbol) => latest(symbol)?.totalDebt ?? null],
    ["52W Performance", (symbol) => performance52W(bundles.get(symbol)?.quote ?? null, bundles.get(symbol)?.historicalPrices ?? [])],
  ];
  return valueRows.map(([metric, read]) => {
    const values = Object.fromEntries(symbols.map((symbol) => [symbol, read(symbol)]));
    const known = Object.values(values).filter((value): value is number => value !== null && Number.isFinite(value));
    return { metric, values, difference: known.length >= 2 ? Math.max(...known) - Math.min(...known) : null, missingSymbols: symbols.filter((symbol) => values[symbol] === null) };
  });
}

export const compareAssetsTool: AssistantToolDefinition<{ symbols: string[] }, AssetComparisonData> = {
  name: "compareAssets",
  description: "Compares available normalized metrics across assets without ranking, scoring or selecting a winner.",
  inputSchema: { type: "object", properties: { symbols: { type: "array", description: "Between 2 and 5 ticker symbols", required: true } }, required: ["symbols"] },
  async execute(input, context) {
    const symbols = symbolsInput(input.symbols);
    const bundles = new Map<string, AssetBundle>();
    await Promise.all(symbols.map(async (symbol) => bundles.set(symbol, await assetBundle(context, symbol, { history: true }))));
    const provenance = [...bundles.values()].flatMap(bundleProvenance);
    const missing = [...bundles.entries()].flatMap(([symbol, bundle]) => bundleMissingData(symbol, bundle, true));
    return successResult({ symbols, metrics: comparisonValues(symbols, bundles) }, provenance, missing);
  },
};

export interface AssetScenarioToolData {
  symbol: string;
  changePercent: number;
  currentPortfolioValue: number | null;
  estimatedPortfolioValue: number | null;
  absoluteImpact: number | null;
  percentageImpact: number | null;
  positionWeight: number | null;
  assumptions: string[];
}

export const runAssetScenarioTool: AssistantToolDefinition<{ symbol: string; changePercent: number }, AssetScenarioToolData> = {
  name: "runAssetScenario",
  description: "Applies one mechanical asset shock through the existing portfolio scenario engine.",
  inputSchema: { type: "object", properties: { symbol: { type: "string", description: "Ticker symbol", required: true }, changePercent: { type: "number", description: "Percentage move, for example -20", required: true } }, required: ["symbol", "changePercent"] },
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const changePercent = percentInput(input.changePercent);
    const valuation = await portfolioValuation(context);
    const position = valuation.summary.positions.find((item) => item.symbol.toUpperCase() === symbol);
    const result = calculateScenario(valuation.summary, [{ key: position?.assetId ?? symbol, label: symbol, shock: changePercent / 100 }]);
    return successResult({ symbol, changePercent, currentPortfolioValue: result.baselineValue, estimatedPortfolioValue: result.estimatedValue, absoluteImpact: result.impact, percentageImpact: result.impactPercent, positionWeight: position?.weight ?? null, assumptions: result.assumptions }, [
      { source: "Your Portfolio", label: "Portfolio and position values", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" },
      { source: "Calculated", label: "Existing scenario engine", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" },
    ], position ? [] : [`${symbol} is not in the authenticated user's portfolio`]);
  },
};

export const runMultiAssetScenarioTool: AssistantToolDefinition<{ changes: Array<{ symbol: string; changePercent: number }> }, { changes: Array<{ symbol: string; changePercent: number }>; result: ScenarioResult }> = {
  name: "runMultiAssetScenario",
  description: "Applies multiple independent mechanical shocks through the existing scenario engine.",
  inputSchema: { type: "object", properties: { changes: { type: "array", description: "Asset symbols and percentage moves", required: true } }, required: ["changes"] },
  async execute(input, context) {
    if (!Array.isArray(input.changes) || !input.changes.length || input.changes.length > 10) throw new Error("changes must contain between 1 and 10 items");
    const changes = input.changes.map((item) => ({ symbol: symbolInput(item.symbol), changePercent: percentInput(item.changePercent) }));
    const valuation = await portfolioValuation(context);
    const result = calculateScenario(valuation.summary, changes.map((change) => ({ key: valuation.summary.positions.find((position) => position.symbol === change.symbol)?.assetId ?? change.symbol, label: change.symbol, shock: change.changePercent / 100 })));
    return successResult({ changes, result }, [{ source: "Your Portfolio", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" }, { source: "Calculated", label: "Existing scenario engine", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" }], result.dataQuality === "COMPLETE" ? [] : ["One or more scenario rows have unknown position values"]);
  },
};

export const runFxScenarioTool: AssistantToolDefinition<{ currency: string; changePercent: number }, ScenarioResult> = {
  name: "runFxScenario",
  description: "Applies a mechanical FX shock through the existing portfolio FX scenario engine.",
  inputSchema: { type: "object", properties: { currency: { type: "string", description: "EUR, USD, CHF or GBP", required: true }, changePercent: { type: "number", description: "FX percentage move", required: true } }, required: ["currency", "changePercent"] },
  async execute(input, context) {
    const currency = String(input.currency).toUpperCase();
    if (currency !== "EUR" && currency !== "USD" && currency !== "CHF" && currency !== "GBP") throw new Error("currency is invalid");
    const changePercent = percentInput(input.changePercent);
    const valuation = await portfolioValuation(context);
    const result = calculateFxScenario(valuation.summary, currency, changePercent / 100);
    return successResult(result, [{ source: "Your Portfolio", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" }, { source: "Calculated", label: "Existing FX scenario engine", asOfDate: null, retrievedAt: new Date().toISOString(), freshness: "CURRENT" }], result.dataQuality === "COMPLETE" ? [] : ["FX scenario contains unknown exposure values"]);
  },
};

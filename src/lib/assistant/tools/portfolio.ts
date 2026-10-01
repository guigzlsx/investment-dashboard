import { portfolioInsightEngine } from "../../insights/engine";
import { buildPortfolioHealth } from "../../portfolio/exposures";
import { getPortfolioAttribution } from "../../portfolio/attribution-service";
import { listInvestmentNotes, getDefaultWatchlist, listWatchlistItems } from "../../supabase/repositories";
import { getPortfolioValuation } from "../../portfolio/service";
import type { AssistantToolDefinition } from "../types";
import { calculatedProvenance, portfolioProvenance, provenanceFromMarket } from "../provenance";
import { assistantProvider, memoized, portfolioMissingData, portfolioOutputProvenance, portfolioValuation, successResult } from "./helpers";
import { periodInput, symbolInput } from "../tool-inputs";

type Valuation = Awaited<ReturnType<typeof getPortfolioValuation>>;

function portfolioInputSchema() {
  return { type: "object" as const, properties: {}, required: [] };
}

function portfolioData(valuation: Valuation) {
  return { summary: valuation.summary, errors: valuation.errors, insights: portfolioInsightEngine.generate(valuation.summary) };
}

export const getPortfolioSummaryTool: AssistantToolDefinition<Record<string, unknown>, ReturnType<typeof portfolioData>> = {
  name: "getPortfolioSummary",
  description: "Returns the authenticated user's calculated portfolio summary and deterministic insights.",
  inputSchema: portfolioInputSchema(),
  async execute(_input, context) {
    const valuation = await portfolioValuation(context);
    return successResult(portfolioData(valuation), portfolioOutputProvenance(), portfolioMissingData(valuation));
  },
};

export const getPositionsTool: AssistantToolDefinition<Record<string, unknown>, Valuation["summary"]["positions"]> = {
  name: "getPositions",
  description: "Returns all positions derived from the authenticated user's transaction ledger.",
  inputSchema: portfolioInputSchema(),
  async execute(_input, context) {
    const valuation = await portfolioValuation(context);
    return successResult(valuation.summary.positions, portfolioOutputProvenance(), portfolioMissingData(valuation));
  },
};

export const getPositionTool: AssistantToolDefinition<{ symbol: string }, Valuation["summary"]["positions"][number] | null> = {
  name: "getPosition",
  description: "Returns one authenticated user's position by symbol, if it exists.",
  inputSchema: { type: "object", properties: { symbol: { type: "string", description: "Ticker symbol", required: true } }, required: ["symbol"] },
  async execute(input, context) {
    const symbol = symbolInput(input.symbol);
    const valuation = await portfolioValuation(context);
    const position = valuation.summary.positions.find((item) => item.symbol.toUpperCase() === symbol);
    return successResult(position ?? null, portfolioOutputProvenance(), position ? portfolioMissingData(valuation) : [`${symbol} is not in the authenticated user's portfolio`]);
  },
};

export const getPortfolioHealthTool: AssistantToolDefinition<Record<string, unknown>, { summary: Valuation["summary"]; health: ReturnType<typeof buildPortfolioHealth>; errors: Valuation["errors"] }> = {
  name: "getPortfolioHealth",
  description: "Returns deterministic concentration and exposure health calculations for the authenticated portfolio.",
  inputSchema: portfolioInputSchema(),
  async execute(_input, context) {
    const valuation = await portfolioValuation(context);
    const health = buildPortfolioHealth(valuation.summary);
    return successResult({ summary: valuation.summary, health, errors: valuation.errors }, [...portfolioOutputProvenance()], [...portfolioMissingData(valuation), ...health.notes]);
  },
};

export const getPortfolioExposuresTool: AssistantToolDefinition<Record<string, unknown>, ReturnType<typeof buildPortfolioHealth>> = {
  name: "getPortfolioExposures",
  description: "Returns all deterministic portfolio exposure dimensions: company, sector, geography, currency, asset type and theme.",
  inputSchema: portfolioInputSchema(),
  async execute(_input, context) {
    const valuation = await portfolioValuation(context);
    const health = buildPortfolioHealth(valuation.summary);
    return successResult(health, [...portfolioOutputProvenance()], [...portfolioMissingData(valuation), ...health.notes]);
  },
};

export const getPerformanceAttributionTool: AssistantToolDefinition<{ period?: string }, Awaited<ReturnType<typeof getPortfolioAttribution>>> = {
  name: "getPerformanceAttribution",
  description: "Returns deterministic portfolio performance attribution for 1D, 1W or 1M.",
  inputSchema: { type: "object", properties: { period: { type: "string", description: "Attribution period: 1D, 1W or 1M" } }, required: [] },
  async execute(input, context) {
    const period = periodInput(input.period);
    const result = await memoized(context, `portfolio:attribution:${period}`, () => getPortfolioAttribution(context.supabase, context.user.id, period));
    return successResult(result, [portfolioProvenance(), calculatedProvenance("Performance attribution")], result.attribution.dataQuality === "COMPLETE" ? [] : ["Some attribution rows have unknown price or FX data"]);
  },
};

export interface WatchlistToolItem {
  id: string;
  symbol: string;
  name: string | null;
  personalNote: string | null;
  targetPrice: number | null;
  targetCurrency: string | null;
  quote: Awaited<ReturnType<ReturnType<typeof assistantProvider>["getQuote"]>> | null;
  metrics: Awaited<ReturnType<ReturnType<typeof assistantProvider>["getKeyMetrics"]>>[number] | null;
}

export const getWatchlistTool: AssistantToolDefinition<Record<string, unknown>, { items: WatchlistToolItem[] }> = {
  name: "getWatchlist",
  description: "Returns the authenticated user's watchlist items with cached provider quote and metric data.",
  inputSchema: portfolioInputSchema(),
  async execute(_input, context) {
    const watchlist = await memoized(context, "watchlist:main", () => getDefaultWatchlist(context.supabase, context.user.id));
    const rows = await memoized(context, `watchlist:items:${watchlist.id}`, () => listWatchlistItems(context.supabase, watchlist.id));
    const provider = assistantProvider(context);
    const items = await Promise.all(rows.map(async (row): Promise<WatchlistToolItem> => {
      const asset = row.assets as Record<string, unknown>;
      const symbol = String(asset.symbol).toUpperCase();
      const [quote, metrics] = await Promise.allSettled([provider.getQuote(symbol), provider.getKeyMetrics(symbol)]);
      return { id: String(row.id), symbol, name: typeof asset.name === "string" ? asset.name : null, personalNote: typeof row.personal_note === "string" ? row.personal_note : null, targetPrice: typeof row.target_price === "number" ? row.target_price : null, targetCurrency: typeof row.target_currency === "string" ? row.target_currency : null, quote: quote.status === "fulfilled" ? quote.value : null, metrics: metrics.status === "fulfilled" ? metrics.value[0] ?? null : null };
    }));
    const provenance = items.flatMap((item) => [item.quote?.provenance, item.metrics?.provenance].filter((value): value is NonNullable<typeof value> => Boolean(value)).map(provenanceFromMarket));
    const missing = items.flatMap((item) => [item.quote ? null : `${item.symbol}: quote unavailable`, item.metrics ? null : `${item.symbol}: key metrics unavailable`].filter((value): value is string => Boolean(value)));
    return successResult({ items }, [portfolioProvenance("Personal watchlist"), ...provenance], missing);
  },
};

export const getInvestmentThesisTool: AssistantToolDefinition<{ symbol?: string }, { symbol: string | null; notes: unknown[] }> = {
  name: "getInvestmentThesis",
  description: "Returns the authenticated user's personal investment notes and thesis, never generated opinions.",
  inputSchema: { type: "object", properties: { symbol: { type: "string", description: "Optional ticker symbol" } }, required: [] },
  async execute(input, context) {
    const symbol = input.symbol ? symbolInput(input.symbol) : null;
    const notes = await memoized(context, "notes:all", () => listInvestmentNotes(context.supabase, context.user.id));
    const filtered = symbol ? notes.filter((note) => {
      const asset = note.assets as { symbol?: string } | null;
      return asset?.symbol?.toUpperCase() === symbol;
    }) : notes;
    return successResult({ symbol, notes: filtered }, [portfolioProvenance("Personal investment thesis")], filtered.length ? [] : [symbol ? `No personal thesis is stored for ${symbol}` : "No investment thesis is stored"]);
  },
};

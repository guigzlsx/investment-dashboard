import type { SupabaseClient } from "@supabase/supabase-js";
import { portfolioInsightEngine } from "../insights/engine";
import { getMarketDataProvider } from "../market-data/server";
import type { DataProvenance } from "../market-data/models";
import { buildPortfolioHealth } from "../portfolio/exposures";
import type { ScenarioResult } from "../portfolio/scenarios";
import { getPortfolioValuation } from "../portfolio/service";
import { getDefaultWatchlist, listInvestmentNotes, listWatchlistItems } from "../supabase/repositories";

export interface InvestmentContext {
  generatedAt: string;
  portfolio: ReturnType<typeof getPortfolioValuation> extends Promise<infer Value> ? Value extends { summary: infer Summary } ? Summary : never : never;
  positions: unknown[];
  allocations: ReturnType<typeof buildPortfolioHealth>;
  portfolioInsights: ReturnType<typeof portfolioInsightEngine.generate>;
  scenarioResults: ScenarioResult[];
  watchlist: unknown[];
  assets: Record<string, { quote: unknown | null; financials: unknown[]; metrics: unknown[] }>;
  notes: unknown[];
  provenance: Array<{ source: string; endpoint?: string; timestamp?: string; asOfDate?: string | null }>;
}

function provenanceOf(value: unknown): DataProvenance | null {
  if (typeof value !== "object" || value === null || !("provenance" in value)) return null;
  const provenance = (value as { provenance?: unknown }).provenance;
  return typeof provenance === "object" && provenance !== null ? provenance as DataProvenance : null;
}

/** Read-only structured context for a future assistant. It performs no reasoning or recommendation. */
export async function buildInvestmentContext(supabase: SupabaseClient, userId: string, scenarioResults: ScenarioResult[] = []): Promise<InvestmentContext> {
  const valuation = await getPortfolioValuation(supabase, userId);
  const health = buildPortfolioHealth(valuation.summary);
  const insights = portfolioInsightEngine.generate(valuation.summary);
  const watchlist = await (async () => {
    const list = await getDefaultWatchlist(supabase, userId);
    const items = await listWatchlistItems(supabase, list.id);
    const provider = getMarketDataProvider();
    return Promise.all(items.map(async (item) => {
      const asset = item.assets as Record<string, unknown>;
      const symbol = String(asset.symbol);
      const [quote, metrics] = await Promise.allSettled([provider.getQuote(symbol), provider.getKeyMetrics(symbol)]);
      return { id: item.id, asset, quote: quote.status === "fulfilled" ? quote.value : null, metrics: metrics.status === "fulfilled" ? metrics.value : [] };
    }));
  })();
  const notes = await listInvestmentNotes(supabase, userId);
  const symbols = [...new Set([...valuation.summary.positions.map((position) => position.symbol), ...watchlist.map((item) => String((item.asset as Record<string, unknown>).symbol))])];
  const provider = getMarketDataProvider();
  const assetEntries = await Promise.all(symbols.map(async (symbol) => {
    const [quote, financials, metrics] = await Promise.allSettled([provider.getQuote(symbol), provider.getFinancials(symbol), provider.getKeyMetrics(symbol)]);
    return [symbol, { quote: quote.status === "fulfilled" ? quote.value : null, financials: financials.status === "fulfilled" ? financials.value : [], metrics: metrics.status === "fulfilled" ? metrics.value : [] }] as const;
  }));
  const provenance = assetEntries.flatMap(([, asset]) => [asset.quote, ...asset.financials, ...asset.metrics].flatMap((value) => { const item = provenanceOf(value); return item ? [{ source: item.source, endpoint: item.sourceEndpoint, timestamp: item.timestamp, asOfDate: item.asOfDate }] : []; }));
  return { generatedAt: new Date().toISOString(), portfolio: valuation.summary, positions: valuation.summary.positions, allocations: health, portfolioInsights: insights, scenarioResults, watchlist, assets: Object.fromEntries(assetEntries), notes, provenance };
}

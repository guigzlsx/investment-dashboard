import { NextResponse } from "next/server";
import { errorResponse } from "../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../lib/market-data/server";
import { analyzeGrowth, analyzeValuation } from "../../../lib/analysis/fundamentals";
import type { Asset } from "../../../lib/market-data/models";
import { getAuthenticatedSupabase } from "../../../lib/supabase/auth";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getDefaultWatchlist, listWatchlistItems, upsertAsset } from "../../../lib/supabase/repositories";
import { parseSymbol, parseUuid } from "../../../lib/validation/inputs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const watchlist = await getDefaultWatchlist(supabase, user.id);
    const rows = await listWatchlistItems(supabase, watchlist.id);
    const provider = getMarketDataProvider();
    const data = await Promise.all(rows.map(async (row) => {
      const asset = row.assets as Record<string, unknown>;
      const symbol = String(asset.symbol);
      const [quote, metrics, history, financials] = await Promise.allSettled([provider.getQuote(symbol), provider.getKeyMetrics(symbol), provider.getHistoricalPrices(symbol, { limit: 370 }), provider.getFinancials(symbol)]);
      const quoteValue = quote.status === "fulfilled" ? quote.value : null;
      const metricValues = metrics.status === "fulfilled" ? metrics.value : [];
      const historyValues = history.status === "fulfilled" ? history.value : [];
      const currentPrice = quoteValue?.price ?? null;
      const closeAt = (date: Date) => [...historyValues].filter((item) => item.close !== null && new Date(item.date) <= date).sort((left, right) => right.date.localeCompare(left.date))[0]?.close ?? null;
      const changeFrom = (close: number | null) => currentPrice !== null && close !== null && close !== 0 ? currentPrice / close - 1 : null;
      const growth = financials.status === "fulfilled" ? analyzeGrowth(financials.value) : null;
      const valuation = metrics.status === "fulfilled" ? analyzeValuation(metricValues) : null;
      const pe = valuation?.metrics.find((item) => item.metric === "pe") ?? null;
      const opportunities = [currentPrice !== null && quoteValue?.yearHigh ? currentPrice / quoteValue.yearHigh - 1 <= -0.2 ? `${symbol} is at least 20% below its 52-week high.` : null : null, growth?.revenueTrend === "ACCELERATING" ? "Revenue growth accelerated in the latest observations." : null, pe?.relativeToMedian !== null && pe?.relativeToMedian !== undefined && pe.relativeToMedian < 0 ? "P/E is below its available historical median." : null].filter((item): item is string => Boolean(item));
      return { id: row.id, asset, quote: quoteValue, metrics: metrics.status === "fulfilled" ? metrics.value[0] ?? null : null, intelligence: { change1M: changeFrom(closeAt(new Date(Date.now() - 30 * 86400000))), ytd: changeFrom(closeAt(new Date(new Date().getFullYear(), 0, 1))), distanceFrom52WHigh: currentPrice !== null && quoteValue?.yearHigh ? currentPrice / quoteValue.yearHigh - 1 : null, forwardPe: pe?.current ?? null, growthTrend: growth?.revenueTrend ?? "UNKNOWN", opportunities } };
    }));
    return NextResponse.json({ data, watchlist });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const body = await request.json() as Record<string, unknown>;
    const watchlist = await getDefaultWatchlist(supabase, user.id);
    const assetBody = body.asset as Record<string, unknown> | undefined;
    const symbol = parseSymbol(String(assetBody?.symbol ?? ""));
    const currency = assetBody?.currency === "EUR" || assetBody?.currency === "USD" || assetBody?.currency === "CHF" || assetBody?.currency === "GBP" ? assetBody.currency : null;
    const asset: Asset = {
      symbol,
      name: typeof assetBody?.name === "string" ? assetBody.name : symbol,
      exchange: typeof assetBody?.exchange === "string" ? assetBody.exchange : null,
      exchangeName: typeof assetBody?.exchangeName === "string" ? assetBody.exchangeName : null,
      currency,
      assetType: assetBody?.assetType === "STOCK" || assetBody?.assetType === "ETF" ? assetBody.assetType : null,
      country: null,
      sector: null,
      industry: null,
      logoUrl: null,
      provenance: { source: "FMP", sourceEndpoint: "search-symbol", timestamp: new Date().toISOString(), asOfDate: null, dataKind: "UNKNOWN" as const, freshness: "UNKNOWN" as const },
    };
    const storedAsset = await upsertAsset(createSupabaseAdminClient(), asset);
    const inserted = await supabase.from("watchlist_items").upsert({ watchlist_id: watchlist.id, asset_id: storedAsset.id }, { onConflict: "watchlist_id,asset_id" }).select("id, asset_id").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const id = parseUuid(new URL(request.url).searchParams.get("id"), "id");
    const watchlist = await getDefaultWatchlist(supabase, user.id);
    const result = await supabase.from("watchlist_items").delete().eq("id", id).eq("watchlist_id", watchlist.id);
    if (result.error) throw result.error;
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}

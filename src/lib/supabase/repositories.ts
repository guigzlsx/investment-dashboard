import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { Asset } from "../market-data/models";
import type { Quote } from "../market-data/models";
import type { FxRate } from "../portfolio/calculations";
import type { Currency, PortfolioSnapshot, PortfolioTransaction, TransactionType } from "../portfolio/types";

type DatabaseRow = Record<string, unknown>;
type TypedSupabaseClient = SupabaseClient<Database>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
}

function currencyValue(value: unknown): Currency | null {
  const currency = stringValue(value)?.toUpperCase();
  return currency === "EUR" || currency === "USD" || currency === "CHF" || currency === "GBP" ? currency : null;
}

export async function getDefaultPortfolio(supabase: TypedSupabaseClient, userId: string) {
  const existing = await supabase.from("portfolios").select("id, user_id, name, base_currency").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase.from("portfolios").insert({ user_id: userId, name: "Main portfolio", base_currency: "EUR" }).select("id, user_id, name, base_currency").single();
  if (created.error) throw created.error;
  return created.data;
}

export async function getDefaultWatchlist(supabase: TypedSupabaseClient, userId: string) {
  const existing = await supabase.from("watchlists").select("id, user_id, name").eq("user_id", userId).eq("name", "Main watchlist").maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase.from("watchlists").insert({ user_id: userId, name: "Main watchlist" }).select("id, user_id, name").single();
  if (created.error) throw created.error;
  return created.data;
}

export async function listTransactions(supabase: TypedSupabaseClient, portfolioId: string): Promise<PortfolioTransaction[]> {
  const result = await supabase.from("transactions").select("id, portfolio_id, asset_id, type, quantity, price, currency, quote_currency, fees, fx_rate_to_base, fx_rate_as_of, fx_source, executed_at, created_at, assets(symbol, name, currency, asset_type, provider_symbols, exchange, sector, country)").eq("portfolio_id", portfolioId).order("executed_at", { ascending: true });
  if (result.error) throw result.error;

  const rows = result.data as DatabaseRow[];
  const themes = await listAssetThemes(supabase, rows.map((row) => String(row.asset_id)).filter(Boolean)).catch(() => new Map<string, string[]>());
  return rows.map((row) => {
    const asset = (row.assets && typeof row.assets === "object" ? row.assets : {}) as DatabaseRow;
    const symbol = stringValue(asset.symbol) ?? "UNKNOWN";
    const providerSymbols = asset.provider_symbols && typeof asset.provider_symbols === "object" && !Array.isArray(asset.provider_symbols)
      ? asset.provider_symbols as Record<string, unknown>
      : {};
    const providerSymbol = typeof providerSymbols.FMP === "string" && providerSymbols.FMP.trim() ? providerSymbols.FMP : symbol;
    return {
      id: String(row.id),
      portfolioId: String(row.portfolio_id),
      assetId: stringValue(row.asset_id) ?? undefined,
      symbol,
      providerSymbol,
      providerSymbols,
      exchange: stringValue(asset.exchange) ?? undefined,
      name: stringValue(asset.name) ?? undefined,
      assetType: asset.asset_type === "STOCK" || asset.asset_type === "ETF" ? asset.asset_type : undefined,
      assetCurrency: currencyValue(asset.currency) ?? undefined,
      sector: stringValue(asset.sector) ?? undefined,
      country: stringValue(asset.country) ?? undefined,
      themes: themes.get(String(row.asset_id)) ?? [],
      type: String(row.type) as TransactionType,
      quantity: numberValue(row.quantity),
      unitPrice: numberValue(row.price),
      currency: currencyValue(row.currency) ?? "EUR",
      quoteCurrency: currencyValue(row.quote_currency) ?? currencyValue(asset.currency) ?? undefined,
      fees: numberValue(row.fees) ?? 0,
      fxRateToBase: numberValue(row.fx_rate_to_base) ?? undefined,
      fxRateDate: stringValue(row.fx_rate_as_of) ?? undefined,
      fxSource: stringValue(row.fx_source) ?? undefined,
      executedAt: String(row.executed_at),
      createdAt: stringValue(row.created_at) ?? undefined,
    };
  });
}

export interface PersistedMarketQuote {
  assetId: string;
  price: number | null;
  currency: Currency | null;
  change1D: number | null;
  source: string;
  sourceEndpoint: string;
  dataKind: string;
  asOf: string | null;
  fetchedAt: string;
}

export async function listLatestMarketQuotes(supabase: TypedSupabaseClient, assetIds: string[]) {
  const latest = new Map<string, PersistedMarketQuote>();
  if (!assetIds.length) return latest;
  const result = await supabase.from("market_quotes").select("asset_id, price, currency, change_1d, source, source_endpoint, data_kind, as_of, fetched_at").in("asset_id", assetIds).order("fetched_at", { ascending: false });
  if (result.error) throw result.error;
  for (const row of result.data) {
    if (latest.has(row.asset_id)) continue;
    latest.set(row.asset_id, {
      assetId: row.asset_id,
      price: typeof row.price === "number" ? row.price : null,
      currency: currencyValue(row.currency),
      change1D: typeof row.change_1d === "number" ? row.change_1d : null,
      source: row.source,
      sourceEndpoint: row.source_endpoint,
      dataKind: row.data_kind,
      asOf: row.as_of,
      fetchedAt: row.fetched_at,
    });
  }
  return latest;
}

export async function listAssetThemes(supabase: TypedSupabaseClient, assetIds: string[]) {
  if (!assetIds.length) return new Map<string, string[]>();
  const result = await supabase.from("asset_themes").select("asset_id, theme").in("asset_id", assetIds);
  if (result.error) throw result.error;
  const themes = new Map<string, string[]>();
  for (const row of result.data as DatabaseRow[]) {
    const assetId = String(row.asset_id); const theme = stringValue(row.theme);
    if (theme) themes.set(assetId, [...(themes.get(assetId) ?? []), theme]);
  }
  return themes;
}

export async function upsertAsset(supabase: TypedSupabaseClient, asset: Asset) {
  const result = await supabase.from("assets").upsert({
    symbol: asset.symbol,
    name: asset.name,
    isin: asset.isin ?? null,
    exchange: asset.exchange,
    exchange_name: asset.exchangeName,
    currency: asset.currency,
    asset_type: asset.assetType,
    country: asset.country,
    sector: asset.sector,
    industry: asset.industry,
    logo_url: asset.logoUrl,
    provider_symbols: { FMP: asset.symbol },
  }, { onConflict: "symbol,exchange" }).select("id, symbol, name, exchange, currency").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function listAssetsBySymbol(supabase: TypedSupabaseClient, symbol: string) {
  const result = await supabase.from("assets").select("id, symbol, name, isin, exchange, currency, asset_type").eq("symbol", symbol.toUpperCase()).order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data;
}

export async function findAssetByIsin(supabase: TypedSupabaseClient, isin: string) {
  const result = await supabase.from("assets").select("id, symbol, name, isin, exchange, currency, asset_type").eq("isin", isin.toUpperCase()).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function listWatchlistItems(supabase: TypedSupabaseClient, watchlistId: string) {
  const result = await supabase.from("watchlist_items").select("id, asset_id, personal_note, target_price, target_currency, created_at, assets(id, symbol, name, exchange, exchange_name, currency, asset_type, country, sector, industry, logo_url)").eq("watchlist_id", watchlistId).order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data as DatabaseRow[];
}

export async function persistMarketQuote(supabase: TypedSupabaseClient, assetId: string, quote: Quote) {
  const result = await supabase.from("market_quotes").insert({ asset_id: assetId, price: quote.price, currency: quote.currency, change_1d: quote.change1D, change_1d_percent: quote.change1DPercent, market_cap: quote.marketCap, volume: quote.volume, data_kind: quote.provenance.dataKind, as_of: quote.provenance.asOfDate, fetched_at: quote.provenance.timestamp, source: quote.provenance.source, source_endpoint: quote.provenance.sourceEndpoint });
  if (result.error) throw result.error;
}

export async function persistFxRate(supabase: TypedSupabaseClient, rate: FxRate) {
  const result = await supabase.from("fx_rates").upsert({ from_currency: rate.fromCurrency, to_currency: rate.toCurrency, rate: rate.rate, as_of_date: rate.asOfDate, source: rate.source, fetched_at: rate.timestamp }, { onConflict: "from_currency,to_currency,as_of_date,source" });
  if (result.error) throw result.error;
}

export async function listPortfolioSnapshots(supabase: TypedSupabaseClient, portfolioId: string): Promise<PortfolioSnapshot[]> {
  const result = await supabase.from("portfolio_snapshots").select("id, portfolio_id, captured_at, total_value_base, invested_cost_base, pnl_base, cash_base, currency, data_quality").eq("portfolio_id", portfolioId).order("captured_at", { ascending: true });
  if (result.error) throw result.error;
  return (result.data as DatabaseRow[]).map((row) => ({ id: String(row.id), portfolioId: String(row.portfolio_id), capturedAt: String(row.captured_at), portfolioValue: numberValue(row.total_value_base), investedCapital: numberValue(row.invested_cost_base), unrealizedPnl: numberValue(row.pnl_base), cash: numberValue(row.cash_base), currency: currencyValue(row.currency) ?? "EUR", dataQuality: row.data_quality === "COMPLETE" || row.data_quality === "PARTIAL" ? row.data_quality : "UNKNOWN" }));
}

export async function insertPortfolioSnapshot(supabase: TypedSupabaseClient, snapshot: PortfolioSnapshot) {
  const result = await supabase.from("portfolio_snapshots").insert({ portfolio_id: snapshot.portfolioId, captured_at: snapshot.capturedAt, total_value_base: snapshot.portfolioValue, invested_cost_base: snapshot.investedCapital, pnl_base: snapshot.unrealizedPnl, cash_base: snapshot.cash, currency: snapshot.currency, data_quality: snapshot.dataQuality }).select("id, portfolio_id, captured_at, total_value_base, invested_cost_base, pnl_base, cash_base, currency, data_quality").single();
  if (result.error) throw result.error;
  return (await listPortfolioSnapshots(supabase, snapshot.portfolioId)).find((item) => item.id === result.data.id) ?? snapshot;
}

export async function findAssetBySymbol(supabase: TypedSupabaseClient, symbol: string) {
  const result = await supabase.from("assets").select("id, symbol, name, exchange, currency, asset_type").eq("symbol", symbol).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (result.error) throw result.error;
  return result.data;
}

export async function listInvestmentNotes(supabase: TypedSupabaseClient, userId: string, assetId?: string) {
  let query = supabase.from("investment_notes").select("id, user_id, portfolio_id, asset_id, thesis, horizon, risks, invalidation_conditions, target_expectations, personal_notes, status, review_status, created_at, updated_at, assets(symbol, name)").eq("user_id", userId).order("updated_at", { ascending: false });
  if (assetId) query = query.eq("asset_id", assetId);
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}

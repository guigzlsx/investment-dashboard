import type { SupabaseClient } from "@supabase/supabase-js";
import { getEcbFxRateProvider } from "../fx/ecb";
import { MarketDataProviderError } from "../market-data/errors";
import { getMarketDataProvider } from "../market-data/server";
import type { Quote } from "../market-data/models";
import type { MarketDataAssetContext } from "../market-data/symbols";
import { createSupabaseAdminClient } from "../supabase/admin";
import { getDefaultPortfolio, listLatestMarketQuotes, listTransactions, persistFxRate, persistMarketQuote, type PersistedMarketQuote } from "../supabase/repositories";
import { calculatePositions, hasFxRate, valuePositions, type FxRate, type PositionQuote } from "./calculations";
import type { Currency, PositionValuationDiagnostic, PositionValuationReason } from "./types";

type ValuationError = { symbol: string; providerSymbol?: string; code?: string; message: string };

export const MAX_STALE_QUOTE_AGE_MS = 24 * 60 * 60 * 1000;

function providerFailure(error: unknown): { reason: PositionValuationReason; code: string; message: string } {
  if (error instanceof MarketDataProviderError) {
    if (error.code === "RATE_LIMIT") return { reason: "RATE_LIMIT", code: error.code, message: error.message };
    if (error.code === "NOT_FOUND") return { reason: "QUOTE_NOT_FOUND", code: error.code, message: error.message };
    return { reason: "PROVIDER_ERROR", code: error.code, message: error.message };
  }
  return { reason: "PROVIDER_ERROR", code: "PROVIDER_ERROR", message: error instanceof Error ? error.message : "Quote unavailable" };
}

function stalePositionQuote(position: { symbol: string; providerSymbol?: string; quoteCurrency: Currency | null }, stored: PersistedMarketQuote | undefined): PositionQuote | null {
  if (!stored || stored.price === null) return null;
  const age = Date.now() - new Date(stored.fetchedAt).getTime();
  if (!Number.isFinite(age) || age > MAX_STALE_QUOTE_AGE_MS) return null;
  return {
    symbol: position.symbol,
    providerSymbol: position.providerSymbol ?? position.symbol,
    price: stored.price,
    currency: stored.currency ?? position.quoteCurrency,
    change1D: stored.change1D,
    provenance: {
      source: stored.source,
      timestamp: stored.fetchedAt,
      asOfDate: stored.asOf?.slice(0, 10) ?? null,
      freshness: "STALE",
    },
  };
}

export async function getPortfolioValuation(supabase: SupabaseClient, userId: string) {
  const portfolio = await getDefaultPortfolio(supabase, userId);
  const baseCurrency = String(portfolio.base_currency).toUpperCase() as Currency;
  const transactions = await listTransactions(supabase, portfolio.id);
  const positions = calculatePositions(transactions, { baseCurrency });
  const provider = getMarketDataProvider();
  const quotes = new Map<string, PositionQuote>();
  const errors: ValuationError[] = [];
  const diagnostics = new Map<string, PositionValuationDiagnostic>();
  const persistedQuotes = await listLatestMarketQuotes(supabase, positions.flatMap((position) => position.assetId ? [position.assetId] : [])).catch(() => new Map<string, PersistedMarketQuote>());
  let admin: SupabaseClient | null = null;
  try { admin = createSupabaseAdminClient(); } catch { admin = null; }

  await Promise.all(positions.map(async (position) => {
    const key = position.assetId ?? position.symbol;
    const providerSymbol = position.providerSymbol ?? position.symbol;
    try {
      const assetContext: MarketDataAssetContext = { symbol: position.symbol, exchange: position.exchange, currency: position.quoteCurrency ?? position.assetCurrency, providerSymbols: position.providerSymbols };
      const assetAwareProvider = provider as typeof provider & { getQuoteForAsset?: (asset: MarketDataAssetContext) => Promise<Quote> };
      const quote = assetAwareProvider.getQuoteForAsset
        ? await assetAwareProvider.getQuoteForAsset(assetContext)
        : await provider.getQuote(providerSymbol);
      if (quote.price === null) throw new MarketDataProviderError(`No quote found for ${providerSymbol}`, "NOT_FOUND");
      const resolvedProviderSymbol = quote.providerSymbol ?? providerSymbol;
      quotes.set(key, { symbol: position.symbol, providerSymbol: resolvedProviderSymbol, price: quote.price, currency: quote.currency ?? position.quoteCurrency, change1D: quote.change1D, provenance: quote.provenance });
      if (admin && position.assetId) await persistMarketQuote(admin, position.assetId, quote).catch(() => undefined);
      diagnostics.set(key, {
        assetId: position.assetId ?? null,
        symbol: position.symbol,
        providerSymbol: resolvedProviderSymbol,
        assetCurrency: position.assetCurrency ?? null,
        quoteCurrency: quote.currency ?? position.quoteCurrency ?? null,
        portfolioCurrency: baseCurrency,
        quoteAvailable: true,
        quoteSource: quote.provenance.source,
        quoteTimestamp: quote.provenance.providerTimestamp ?? quote.provenance.timestamp,
        quoteAsOfDate: quote.provenance.asOfDate,
        quoteFreshness: quote.provenance.freshness,
        fxRequired: false,
        fxAvailable: false,
        marketValueCalculable: false,
        reason: "VALUED",
      });
    } catch (error) {
      const failure = providerFailure(error);
      const stale = stalePositionQuote(position, position.assetId ? persistedQuotes.get(position.assetId) : undefined);
      if (stale) {
        quotes.set(key, stale);
        diagnostics.set(key, {
          assetId: position.assetId ?? null,
          symbol: position.symbol,
          providerSymbol,
          assetCurrency: position.assetCurrency ?? null,
          quoteCurrency: stale.currency,
          portfolioCurrency: baseCurrency,
          quoteAvailable: true,
          quoteSource: stale.provenance?.source ?? null,
          quoteTimestamp: stale.provenance?.timestamp ?? null,
          quoteAsOfDate: stale.provenance?.asOfDate ?? null,
          quoteFreshness: "STALE",
          fxRequired: false,
          fxAvailable: false,
          marketValueCalculable: false,
          reason: "STALE_CACHE",
          providerErrorCode: failure.code,
          message: `${failure.message}; using the last persisted quote as stale data`,
        });
        errors.push({ symbol: position.symbol, providerSymbol, code: failure.code, message: `${failure.message}; using stale quote` });
      } else {
        diagnostics.set(key, {
          assetId: position.assetId ?? null,
          symbol: position.symbol,
          providerSymbol,
          assetCurrency: position.assetCurrency ?? null,
          quoteCurrency: position.quoteCurrency ?? null,
          portfolioCurrency: baseCurrency,
          quoteAvailable: false,
          quoteSource: null,
          quoteTimestamp: null,
          quoteAsOfDate: null,
          quoteFreshness: null,
          fxRequired: Boolean(position.quoteCurrency && position.quoteCurrency !== baseCurrency),
          fxAvailable: false,
          marketValueCalculable: false,
          reason: failure.reason,
          providerErrorCode: failure.code,
          message: failure.message,
        });
        errors.push({ symbol: position.symbol, providerSymbol, code: failure.code, message: failure.message });
      }
    }
  }));

  const quoteCurrencies = [...new Set(positions.flatMap((position) => position.quoteCurrency ? [position.quoteCurrency] : []))];
  let fxRates: FxRate[] = [];
  if (quoteCurrencies.length) {
    try { fxRates = await getEcbFxRateProvider().getRates(quoteCurrencies, baseCurrency); } catch (error) { errors.push({ symbol: "FX", message: error instanceof Error ? error.message : "FX unavailable" }); }
  }
  if (admin) await Promise.all(fxRates.map((rate) => persistFxRate(admin as SupabaseClient, rate).catch(() => undefined)));

  for (const position of positions) {
    const key = position.assetId ?? position.symbol;
    const quote = quotes.get(key);
    const current = diagnostics.get(key) ?? {
      assetId: position.assetId ?? null,
      symbol: position.symbol,
      providerSymbol: position.providerSymbol ?? position.symbol,
      assetCurrency: position.assetCurrency ?? null,
      quoteCurrency: position.quoteCurrency ?? null,
      portfolioCurrency: baseCurrency,
      quoteAvailable: false,
      quoteSource: null,
      quoteTimestamp: null,
      quoteAsOfDate: null,
      quoteFreshness: null,
      fxRequired: false,
      fxAvailable: false,
      marketValueCalculable: false,
      reason: "PROVIDER_ERROR" as const,
    } satisfies PositionValuationDiagnostic;
    const quoteCurrency = quote?.currency ?? current.quoteCurrency ?? position.quoteCurrency ?? null;
    const fxRequired = Boolean(quoteCurrency && quoteCurrency !== baseCurrency);
    const fxAvailable = Boolean(quoteCurrency && hasFxRate(quoteCurrency, baseCurrency, fxRates));
    const quoteAvailable = Boolean(quote && quote.price !== null);
    const marketValueCalculable = quoteAvailable && (!fxRequired || fxAvailable);
    const reason = marketValueCalculable
      ? current.reason === "STALE_CACHE" ? "STALE_CACHE" : "VALUED"
      : quoteAvailable && fxRequired && !fxAvailable ? "FX_MISSING" : current.reason;
    diagnostics.set(key, { ...current, quoteCurrency, quoteAvailable, fxRequired, fxAvailable, marketValueCalculable, reason });
  }

  const rawSummary = valuePositions(positions, quotes, fxRates, baseCurrency);
  const hasStaleQuotes = [...diagnostics.values()].some((diagnostic) => diagnostic.reason === "STALE_CACHE");
  const summary = hasStaleQuotes && rawSummary.dataQuality === "COMPLETE" ? { ...rawSummary, dataQuality: "PARTIAL" as const } : rawSummary;
  return { portfolio, transactions, summary, errors, quotes, fxRates, diagnostics: [...diagnostics.values()] };
}

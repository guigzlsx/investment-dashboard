import type { SupabaseClient } from "@supabase/supabase-js";
import { getEcbFxRateProvider } from "../fx/ecb";
import { getMarketDataProvider } from "../market-data/server";
import { createSupabaseAdminClient } from "../supabase/admin";
import { getDefaultPortfolio, listTransactions, persistFxRate, persistMarketQuote } from "../supabase/repositories";
import { calculatePositions, valuePositions, type FxRate, type PositionQuote } from "./calculations";
import type { Currency } from "./types";

export async function getPortfolioValuation(supabase: SupabaseClient, userId: string) {
  const portfolio = await getDefaultPortfolio(supabase, userId);
  const baseCurrency = String(portfolio.base_currency).toUpperCase() as Currency;
  const transactions = await listTransactions(supabase, portfolio.id);
  const positions = calculatePositions(transactions, { baseCurrency });
  const provider = getMarketDataProvider();
  const quotes = new Map<string, PositionQuote>();
  const errors: Array<{ symbol: string; message: string }> = [];
  let admin: SupabaseClient | null = null;
  try { admin = createSupabaseAdminClient(); } catch { admin = null; }

  await Promise.all(positions.map(async (position) => {
    try {
      const quote = await provider.getQuote(position.symbol);
      quotes.set(position.assetId ?? position.symbol, { symbol: position.symbol, price: quote.price, currency: quote.currency ?? position.quoteCurrency, change1D: quote.change1D });
      if (admin && position.assetId) await persistMarketQuote(admin, position.assetId, quote).catch(() => undefined);
    } catch (error) {
      errors.push({ symbol: position.symbol, message: error instanceof Error ? error.message : "Quote unavailable" });
    }
  }));

  const quoteCurrencies = [...quotes.values()].flatMap((quote) => quote.currency ? [quote.currency] : []);
  let fxRates: FxRate[] = [];
  if (quoteCurrencies.length) {
    try { fxRates = await getEcbFxRateProvider().getRates(quoteCurrencies, baseCurrency); } catch (error) { errors.push({ symbol: "FX", message: error instanceof Error ? error.message : "FX unavailable" }); }
  }
  if (admin) await Promise.all(fxRates.map((rate) => persistFxRate(admin as SupabaseClient, rate).catch(() => undefined)));
  return { portfolio, transactions, summary: valuePositions(positions, quotes, fxRates, baseCurrency), errors, quotes, fxRates };
}

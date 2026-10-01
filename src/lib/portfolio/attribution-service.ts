import { getMarketDataProvider } from "../market-data/server";
import { calculateAttribution, type AttributionChange, type PortfolioAttribution } from "./attribution";
import { getPortfolioValuation } from "./service";
import type { Currency } from "./types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";

function rateFor(currency: Currency | null, baseCurrency: Currency, rates: Array<{ fromCurrency: Currency; toCurrency: Currency; rate: number }>) {
  if (!currency || currency === baseCurrency) return currency ? 1 : null;
  const direct = rates.find((rate) => rate.fromCurrency === currency && rate.toCurrency === baseCurrency);
  if (direct) return direct.rate;
  const inverse = rates.find((rate) => rate.fromCurrency === baseCurrency && rate.toCurrency === currency);
  return inverse ? 1 / inverse.rate : null;
}

export async function getPortfolioAttribution(supabase: SupabaseClient<Database>, userId: string, period: PortfolioAttribution["period"]) {
  const valuation = await getPortfolioValuation(supabase, userId);
  const days = period === "1D" ? 1 : period === "1W" ? 7 : 30;
  const target = new Date();
  target.setDate(target.getDate() - days);
  const provider = getMarketDataProvider();
  const changes = await Promise.all(valuation.summary.positions.map(async (position): Promise<AttributionChange> => {
    const quote = valuation.quotes.get(position.assetId ?? position.symbol);
    const fx = rateFor(quote?.currency ?? position.quoteCurrency, valuation.summary.baseCurrency, valuation.fxRates);
    if (!quote || quote.price === null || fx === null) return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
    if (period === "1D" && quote.change1D !== null) return { symbol: position.symbol, name: position.name, change: position.quantity * quote.change1D * fx, currency: valuation.summary.baseCurrency, dataQuality: "COMPLETE" };
    try {
      const history = await provider.getHistoricalPrices(position.symbol, { limit: 370 });
      const previous = history.filter((item) => item.close !== null && new Date(item.date) <= target).sort((left, right) => right.date.localeCompare(left.date))[0];
      if (!previous || previous.close === null || previous.close === undefined) return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
      return { symbol: position.symbol, name: position.name, change: position.quantity * (quote.price - previous.close) * fx, currency: valuation.summary.baseCurrency, dataQuality: "COMPLETE" };
    } catch {
      return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
    }
  }));
  return { attribution: calculateAttribution(period, changes), errors: valuation.errors };
}

import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../lib/market-data/server";
import { calculateAttribution, type AttributionChange, type PortfolioAttribution } from "../../../../lib/portfolio/attribution";
import { getPortfolioValuation } from "../../../../lib/portfolio/service";
import type { Currency } from "../../../../lib/portfolio/types";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { InputValidationError } from "../../../../lib/validation/inputs";

function requestedPeriod(value: string | null): PortfolioAttribution["period"] {
  const period = value?.toUpperCase() ?? "1D";
  if (period !== "1D" && period !== "1W" && period !== "1M") throw new InputValidationError("Invalid attribution period");
  return period;
}

function rateFor(currency: Currency | null, baseCurrency: Currency, rates: Array<{ fromCurrency: Currency; toCurrency: Currency; rate: number }>) {
  if (!currency || currency === baseCurrency) return currency ? 1 : null;
  const direct = rates.find((rate) => rate.fromCurrency === currency && rate.toCurrency === baseCurrency);
  if (direct) return direct.rate;
  const inverse = rates.find((rate) => rate.fromCurrency === baseCurrency && rate.toCurrency === currency);
  return inverse ? 1 / inverse.rate : null;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    const period = requestedPeriod(new URL(request.url).searchParams.get("period"));
    const days = period === "1D" ? 1 : period === "1W" ? 7 : 30;
    const target = new Date(); target.setDate(target.getDate() - days);
    const provider = getMarketDataProvider();
    const changes = await Promise.all(valuation.summary.positions.map(async (position): Promise<AttributionChange> => {
      const quote = valuation.quotes.get(position.assetId ?? position.symbol);
      const fx = rateFor(quote?.currency ?? position.quoteCurrency, valuation.summary.baseCurrency, valuation.fxRates);
      if (!quote || quote.price === null || fx === null) return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
      if (period === "1D" && quote.change1D !== null) return { symbol: position.symbol, name: position.name, change: position.quantity * quote.change1D * fx, currency: valuation.summary.baseCurrency, dataQuality: "COMPLETE" };
      try {
        const history = await provider.getHistoricalPrices(position.symbol, { limit: 370 });
        const candidates = history.filter((item) => item.close !== null && new Date(item.date) <= target).sort((left, right) => right.date.localeCompare(left.date));
        const previous = candidates[0];
        if (!previous || previous.close === null || previous.close === undefined) return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
        return { symbol: position.symbol, name: position.name, change: position.quantity * (quote.price - previous.close) * fx, currency: valuation.summary.baseCurrency, dataQuality: "COMPLETE" };
      } catch {
        return { symbol: position.symbol, name: position.name, change: null, currency: valuation.summary.baseCurrency, dataQuality: "UNKNOWN" };
      }
    }));
    return NextResponse.json({ data: calculateAttribution(period, changes), errors: valuation.errors });
  } catch (error) {
    return errorResponse(error);
  }
}

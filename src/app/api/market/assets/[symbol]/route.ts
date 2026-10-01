import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../../lib/market-data/server";
import { analyzeGrowth, analyzeRiskCoverage, analyzeValuation } from "../../../../../lib/analysis/fundamentals";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import { parseSymbol } from "../../../../../lib/validation/inputs";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    await getAuthenticatedSupabase();
    const symbol = parseSymbol((await params).symbol);
    const provider = getMarketDataProvider();
    const [profileResult, quoteResult, metricsResult, historyResult, financialsResult] = await Promise.allSettled([
      provider.getCompanyProfile(symbol),
      provider.getQuote(symbol),
      provider.getKeyMetrics(symbol),
      provider.getHistoricalPrices(symbol, { limit: 120 }),
      provider.getFinancials(symbol),
    ]);
    const successful = [profileResult, quoteResult, metricsResult, historyResult, financialsResult].filter((result) => result.status === "fulfilled");
    if (successful.length === 0) {
      const firstError = [profileResult, quoteResult, metricsResult, historyResult, financialsResult].find((result) => result.status === "rejected");
      throw firstError && firstError.status === "rejected" ? firstError.reason : new Error("No market data available");
    }

    return NextResponse.json({
      data: {
        symbol,
        profile: profileResult.status === "fulfilled" ? profileResult.value : null,
        quote: quoteResult.status === "fulfilled" ? quoteResult.value : null,
        metrics: metricsResult.status === "fulfilled" ? metricsResult.value : [],
        historicalPrices: historyResult.status === "fulfilled" ? historyResult.value : [],
        financials: financialsResult.status === "fulfilled" ? financialsResult.value : [],
        growth: financialsResult.status === "fulfilled" ? analyzeGrowth(financialsResult.value) : null,
        valuation: metricsResult.status === "fulfilled" ? analyzeValuation(metricsResult.value) : null,
        risks: analyzeRiskCoverage(financialsResult.status === "fulfilled" ? financialsResult.value[0] ?? null : null, metricsResult.status === "fulfilled" ? metricsResult.value[0] ?? null : null, metricsResult.status === "fulfilled" ? analyzeValuation(metricsResult.value) : null),
      },
      errors: [profileResult, quoteResult, metricsResult, historyResult, financialsResult].flatMap((result) => result.status === "rejected" ? [{ message: result.reason instanceof Error ? result.reason.message : "Data unavailable" }] : []),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

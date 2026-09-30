import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { filterSnapshotsByPeriod, calculatePerformanceHistory } from "../../../../lib/portfolio/history";
import { getPortfolioValuation } from "../../../../lib/portfolio/service";
import type { PortfolioSnapshot } from "../../../../lib/portfolio/types";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { getDefaultPortfolio, insertPortfolioSnapshot, listPortfolioSnapshots, listTransactions } from "../../../../lib/supabase/repositories";
import { InputValidationError } from "../../../../lib/validation/inputs";

type Period = "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL";

function period(value: string | null): Period {
  const normalized = value?.toUpperCase() ?? "ALL";
  if (!["1D", "1W", "1M", "YTD", "1Y", "ALL"].includes(normalized)) throw new InputValidationError("Invalid performance period");
  return normalized as Period;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const portfolio = await getDefaultPortfolio(supabase, user.id);
    const snapshots = await listPortfolioSnapshots(supabase, portfolio.id);
    const transactions = await listTransactions(supabase, portfolio.id);
    const selected = filterSnapshotsByPeriod(snapshots, period(new URL(request.url).searchParams.get("period")));
    return NextResponse.json({ data: selected, performance: calculatePerformanceHistory(selected, transactions), period: period(new URL(request.url).searchParams.get("period")) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    const snapshot: PortfolioSnapshot = { portfolioId: valuation.portfolio.id, capturedAt: new Date().toISOString(), portfolioValue: valuation.summary.currentValue, investedCapital: valuation.summary.investedCost, unrealizedPnl: valuation.summary.pnl, cash: null, currency: valuation.summary.baseCurrency, dataQuality: valuation.summary.dataQuality };
    const stored = await insertPortfolioSnapshot(supabase, snapshot);
    return NextResponse.json({ data: stored, errors: valuation.errors }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

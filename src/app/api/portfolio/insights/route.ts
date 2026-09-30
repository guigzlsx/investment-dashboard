import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { portfolioInsightEngine } from "../../../../lib/insights/engine";
import { calculatePositions } from "../../../../lib/portfolio/calculations";
import type { Currency } from "../../../../lib/portfolio/types";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { getDefaultPortfolio, listTransactions } from "../../../../lib/supabase/repositories";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const portfolio = await getDefaultPortfolio(supabase, user.id);
    const transactions = await listTransactions(supabase, portfolio.id);
    const positions = calculatePositions(transactions, { baseCurrency: String(portfolio.base_currency).toUpperCase() as Currency });
    const summary = { baseCurrency: String(portfolio.base_currency).toUpperCase() as Currency, investedCost: positions.reduce((total, position) => total + position.costBasis, 0), currentValue: null, pnl: null, performance: null, dailyChange: null, dataQuality: "UNKNOWN" as const, positions };
    return NextResponse.json({ data: portfolioInsightEngine.generate(summary) });
  } catch (error) {
    return errorResponse(error);
  }
}

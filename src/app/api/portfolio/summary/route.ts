import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { getPortfolioValuation } from "../../../../lib/portfolio/service";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    return NextResponse.json({ data: valuation.summary, portfolio: valuation.portfolio, transactions: valuation.transactions, errors: valuation.errors, valuation: valuation.diagnostics });
  } catch (error) {
    return errorResponse(error);
  }
}

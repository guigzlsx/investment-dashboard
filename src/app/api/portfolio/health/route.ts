import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { buildPortfolioHealth } from "../../../../lib/portfolio/exposures";
import { getPortfolioValuation } from "../../../../lib/portfolio/service";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    return NextResponse.json({ data: buildPortfolioHealth(valuation.summary), summary: valuation.summary, errors: valuation.errors });
  } catch (error) {
    return errorResponse(error);
  }
}

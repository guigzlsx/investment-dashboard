import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { getPortfolioAttribution } from "../../../../lib/portfolio/attribution-service";
import type { PortfolioAttribution } from "../../../../lib/portfolio/attribution";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { InputValidationError } from "../../../../lib/validation/inputs";

function requestedPeriod(value: string | null): PortfolioAttribution["period"] {
  const period = value?.toUpperCase() ?? "1D";
  if (period !== "1D" && period !== "1W" && period !== "1M") throw new InputValidationError("Invalid attribution period");
  return period;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const period = requestedPeriod(new URL(request.url).searchParams.get("period"));
    const result = await getPortfolioAttribution(supabase, user.id, period);
    return NextResponse.json({ data: result.attribution, errors: result.errors });
  } catch (error) {
    return errorResponse(error);
  }
}

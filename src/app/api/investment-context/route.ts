import { NextResponse } from "next/server";
import { buildInvestmentContext } from "../../../lib/assistant/context";
import { errorResponse } from "../../../lib/api/error-response";
import { getAuthenticatedSupabase } from "../../../lib/supabase/auth";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    return NextResponse.json({ data: await buildInvestmentContext(supabase, user.id) });
  } catch (error) { return errorResponse(error); }
}

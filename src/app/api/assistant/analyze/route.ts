import { NextResponse } from "next/server";
import { analyzeAssistantQuery } from "../../../../lib/assistant/analyzer";
import { createAssistantToolContext } from "../../../../lib/assistant/tools/registry";
import { queryInput } from "../../../../lib/assistant/tool-inputs";
import { errorResponse } from "../../../../lib/api/error-response";
import { ensureProfile } from "../../../../lib/profile/service";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const body = await request.json() as { query?: unknown };
    const query = queryInput(body.query);
    const profile = await ensureProfile(supabase, user);
    const context = createAssistantToolContext(supabase, user, { baseCurrency: profile.base_currency, analysisDepth: profile.default_analysis_depth === "DETAILED" ? "DETAILED" : "QUICK" });
    const debug = process.env.NODE_ENV !== "production" && new URL(request.url).searchParams.get("debug") === "true";
    return NextResponse.json(await analyzeAssistantQuery({ query, context, debug }));
  } catch (error) {
    return errorResponse(error);
  }
}

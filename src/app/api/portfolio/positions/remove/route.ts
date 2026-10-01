import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import { parseUuid } from "../../../../../lib/validation/inputs";

type RemovePositionBody = {
  portfolioId?: unknown;
  assetId?: unknown;
};

export async function POST(request: Request) {
  try {
    const { supabase } = await getAuthenticatedSupabase();
    const body = await request.json() as RemovePositionBody;
    const portfolioId = parseUuid(body.portfolioId, "portfolioId");
    const assetId = parseUuid(body.assetId, "assetId");
    const result = await supabase.rpc("remove_portfolio_position", {
      p_portfolio_id: portfolioId,
      p_asset_id: assetId,
    });

    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("PORTFOLIO_NOT_FOUND")) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Portfolio not found." } }, { status: 404 });
    }
    if (message.includes("POSITION_NOT_FOUND")) {
      return NextResponse.json({ error: { code: "POSITION_NOT_FOUND", message: "Position not found or already removed." } }, { status: 404 });
    }
    return errorResponse(error);
  }
}

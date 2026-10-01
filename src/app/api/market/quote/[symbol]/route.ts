import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../../lib/market-data/server";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import { parseSymbol } from "../../../../../lib/validation/inputs";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    await getAuthenticatedSupabase();
    const { symbol } = await params;
    return NextResponse.json({ data: await getMarketDataProvider().getQuote(parseSymbol(symbol)) });
  } catch (error) {
    return errorResponse(error);
  }
}

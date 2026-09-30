import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../lib/market-data/server";
import { parseSearchQuery } from "../../../../lib/validation/inputs";

export async function GET(request: Request) {
  try {
    const query = parseSearchQuery(new URL(request.url).searchParams.get("q"));
    const assets = await getMarketDataProvider().searchAssets(query);
    return NextResponse.json({ data: assets, meta: { source: "FMP" } });
  } catch (error) {
    return errorResponse(error);
  }
}

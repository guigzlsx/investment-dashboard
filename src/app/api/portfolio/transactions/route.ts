import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../lib/market-data/server";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getDefaultPortfolio, listTransactions, upsertAsset } from "../../../../lib/supabase/repositories";
import { parseFiniteNumber, parseSymbol, parseUuid } from "../../../../lib/validation/inputs";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const portfolio = await getDefaultPortfolio(supabase, user.id);
    return NextResponse.json({ data: await listTransactions(supabase, portfolio.id), portfolio });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const body = await request.json() as Record<string, unknown>;
    const portfolio = await getDefaultPortfolio(supabase, user.id);
    let assetId: string;
    if (typeof body.assetId === "string") {
      assetId = parseUuid(body.assetId, "assetId");
    } else {
      const symbol = parseSymbol(String(body.symbol ?? ""));
      const matches = await getMarketDataProvider().searchAssets(symbol);
      const match = matches.find((asset) => asset.symbol.toUpperCase() === symbol) ?? matches[0];
      if (!match) return NextResponse.json({ error: { code: "NOT_FOUND", message: `Asset ${symbol} was not found` } }, { status: 404 });
      assetId = String((await upsertAsset(createSupabaseAdminClient(), match)).id);
    }
    const type = body.type === "BUY" || body.type === "SELL" ? body.type : null;
    if (!type) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "type must be BUY or SELL" } }, { status: 400 });
    const quantity = parseFiniteNumber(body.quantity, "quantity", { min: 0.0000000001 });
    const price = parseFiniteNumber(body.price, "price", { min: 0 });
    const fees = parseFiniteNumber(body.fees ?? 0, "fees", { min: 0 });
    const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : null;
    if (!currency || !["EUR", "USD", "CHF", "GBP"].includes(currency)) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "currency is invalid" } }, { status: 400 });
    const fxRateToBase = currency === portfolio.base_currency ? 1 : parseFiniteNumber(body.fxRateToBase, "fxRateToBase", { min: 0.0000000001, nullable: true });
    if (currency !== portfolio.base_currency && fxRateToBase === null) return NextResponse.json({ error: { code: "INVALID_INPUT", message: `fxRateToBase is required for ${currency} transactions in a ${portfolio.base_currency} portfolio` } }, { status: 400 });
    const executedAt = typeof body.executedAt === "string" && !Number.isNaN(Date.parse(body.executedAt)) ? new Date(body.executedAt).toISOString() : null;
    if (!executedAt) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "executedAt is invalid" } }, { status: 400 });

    const inserted = await supabase.from("transactions").insert({ portfolio_id: portfolio.id, asset_id: assetId, type, quantity, price, currency, quote_currency: currency, fees, fx_rate_to_base: fxRateToBase ?? undefined, fx_rate_as_of: executedAt.slice(0, 10), fx_source: currency === portfolio.base_currency ? "same_currency" : "manual" , executed_at: executedAt }).select("id").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

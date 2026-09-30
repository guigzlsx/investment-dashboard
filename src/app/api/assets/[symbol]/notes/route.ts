import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { getMarketDataProvider } from "../../../../../lib/market-data/server";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import { createSupabaseAdminClient } from "../../../../../lib/supabase/admin";
import { getDefaultPortfolio, findAssetBySymbol, listInvestmentNotes, upsertAsset } from "../../../../../lib/supabase/repositories";
import { parseSymbol, parseUuid, InputValidationError } from "../../../../../lib/validation/inputs";

function text(body: Record<string, unknown>, key: string, max = 10_000) {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max) throw new InputValidationError(`${key} is invalid`);
  return value.trim() || null;
}

async function resolveAsset(supabase: Parameters<typeof getDefaultPortfolio>[0], symbol: string) {
  const existing = await findAssetBySymbol(supabase, symbol);
  if (existing) return existing;
  const matches = await getMarketDataProvider().searchAssets(symbol);
  const match = matches.find((asset) => asset.symbol.toUpperCase() === symbol) ?? matches[0];
  if (!match) throw new InputValidationError(`Asset ${symbol} was not found`);
  return upsertAsset(createSupabaseAdminClient(), match);
}

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const symbol = parseSymbol((await params).symbol);
    const asset = await findAssetBySymbol(supabase, symbol);
    return NextResponse.json({ data: asset ? await listInvestmentNotes(supabase, user.id, String(asset.id)) : [] });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const symbol = parseSymbol((await params).symbol);
    const body = await request.json() as Record<string, unknown>;
    const asset = await resolveAsset(supabase, symbol);
    const portfolio = await getDefaultPortfolio(supabase, user.id);
    const inserted = await supabase.from("investment_notes").insert({ user_id: user.id, portfolio_id: portfolio.id, asset_id: asset.id, thesis: text(body, "thesis"), horizon: text(body, "horizon", 500), risks: text(body, "risks"), invalidation_conditions: text(body, "invalidationConditions"), target_expectations: text(body, "targetExpectations"), personal_notes: text(body, "personalNotes") }).select("id").single();
    if (inserted.error) throw inserted.error;
    return NextResponse.json({ data: inserted.data }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const symbol = parseSymbol((await params).symbol);
    const body = await request.json() as Record<string, unknown>;
    const noteId = parseUuid(body.noteId, "noteId");
    const status = String(body.reviewStatus);
    if (!["UNREVIEWED", "UNCHANGED", "STRENGTHENED", "WEAKENED", "INVALIDATED"].includes(status)) throw new InputValidationError("reviewStatus is invalid");
    const asset = await findAssetBySymbol(supabase, symbol);
    if (!asset) throw new InputValidationError(`Asset ${symbol} was not found`);
    const updated = await supabase.from("investment_notes").update({ review_status: status }).eq("id", noteId).eq("user_id", user.id).eq("asset_id", asset.id).select("id, review_status, updated_at").single();
    if (updated.error) throw updated.error;
    return NextResponse.json({ data: updated.data });
  } catch (error) { return errorResponse(error); }
}

import { NextResponse } from "next/server";
import { errorResponse } from "../../../../lib/api/error-response";
import { calculateFxScenario, calculateScenario, type ScenarioShock } from "../../../../lib/portfolio/scenarios";
import { getPortfolioValuation } from "../../../../lib/portfolio/service";
import type { Currency } from "../../../../lib/portfolio/types";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { InputValidationError, parseFiniteNumber, parseSymbol } from "../../../../lib/validation/inputs";

function currency(value: unknown): Currency {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  if (normalized !== "EUR" && normalized !== "USD" && normalized !== "CHF" && normalized !== "GBP") throw new InputValidationError("currency is invalid");
  return normalized;
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    return NextResponse.json({ data: { summary: valuation.summary, positions: valuation.summary.positions.map((position) => ({ key: position.assetId ?? position.symbol, symbol: position.symbol, name: position.name, sector: position.sector, themes: position.themes, weight: position.weight })) } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const valuation = await getPortfolioValuation(supabase, user.id);
    const body = await request.json() as Record<string, unknown>;
    if (body.fx && typeof body.fx === "object") {
      const fx = body.fx as Record<string, unknown>;
      const result = calculateFxScenario(valuation.summary, currency(fx.currency), parseFiniteNumber(fx.shock, "shock", { min: -1, nullable: false }) as number);
      return NextResponse.json({ data: result, errors: valuation.errors });
    }
    if (!Array.isArray(body.shocks)) throw new InputValidationError("shocks must be an array");
    const shocks: ScenarioShock[] = body.shocks.map((item: unknown) => {
      if (typeof item !== "object" || item === null) throw new InputValidationError("invalid scenario shock");
      const shock = item as Record<string, unknown>;
      const key = typeof shock.key === "string" ? shock.key : parseSymbol(String(shock.symbol ?? ""));
      return { key, label: typeof shock.label === "string" ? shock.label : key, shock: parseFiniteNumber(shock.shock, "shock", { min: -1, nullable: false }) as number };
    });
    return NextResponse.json({ data: calculateScenario(valuation.summary, shocks), errors: valuation.errors });
  } catch (error) { return errorResponse(error); }
}

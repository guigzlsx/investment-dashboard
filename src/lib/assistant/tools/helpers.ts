import type { MarketDataProvider } from "../../market-data/provider";
import { getMarketDataProvider } from "../../market-data/server";
import { getPortfolioValuation } from "../../portfolio/service";
import type { AssistantProvenance, AssistantToolContext, ToolResult } from "../types";
import { calculatedProvenance, portfolioProvenance, provenanceFromMarket, resultProvenance } from "../provenance";

export type PortfolioValuation = Awaited<ReturnType<typeof getPortfolioValuation>>;

export function successResult<T>(data: T, provenance: AssistantProvenance[] = [], missingData: string[] = []): ToolResult<T> {
  return { success: true, data, provenance: resultProvenance(provenance), generatedAt: new Date().toISOString(), missingData: [...new Set(missingData)] };
}

export function failureResult<T>(code: string, message: string): ToolResult<T> {
  return { success: false, error: { code, message }, provenance: [], generatedAt: new Date().toISOString(), missingData: [] };
}

export async function memoized<T>(context: AssistantToolContext, key: string, loader: () => Promise<T>) {
  const existing = context.memo.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const value = loader();
  context.memo.set(key, value);
  return value;
}

export function assistantProvider(context: AssistantToolContext): MarketDataProvider {
  return context.provider ?? getMarketDataProvider();
}

export function portfolioValuation(context: AssistantToolContext) {
  return memoized(context, "portfolio:valuation", () => getPortfolioValuation(context.supabase, context.user.id));
}

export function marketProvenance(values: Array<{ provenance: Parameters<typeof provenanceFromMarket>[0] }>) {
  return values.map((value) => provenanceFromMarket(value.provenance));
}

export function portfolioMissingData(valuation: PortfolioValuation) {
  const missing = valuation.errors.map((error) => `${error.symbol}: ${error.message}`);
  if (valuation.summary.currentValue === null) missing.push("Portfolio current value is unknown");
  if (valuation.summary.performance === null) missing.push("Portfolio performance is unknown");
  for (const position of valuation.summary.positions) {
    if (position.currentPrice === null || position.currentPrice === undefined) missing.push(`${position.symbol}: current price is unknown`);
    if (position.currentValue === null || position.currentValue === undefined) missing.push(`${position.symbol}: current value is unknown`);
  }
  return missing;
}

export function portfolioOutputProvenance() {
  return [portfolioProvenance(), calculatedProvenance("Portfolio calculations")];
}

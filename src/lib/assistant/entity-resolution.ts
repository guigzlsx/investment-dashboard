import type { Asset } from "../market-data/models";
import { getMarketDataProvider } from "../market-data/server";
import type { AssistantToolContext, ResolvedEntity } from "./types";

function candidate(asset: Asset) {
  return { symbol: asset.symbol.toUpperCase(), name: asset.name, exchange: asset.exchange };
}

export async function resolveEntity(input: string, context?: Pick<AssistantToolContext, "provider">): Promise<ResolvedEntity> {
  const normalized = input.trim();
  const provider = context?.provider ?? getMarketDataProvider();
  let results: Asset[] = [];
  try {
    results = await provider.searchAssets(normalized);
  } catch {
    return { input: normalized, symbol: null, name: null, ambiguous: false, candidates: [], reason: "NOT_FOUND" };
  }
  const upper = normalized.toUpperCase();
  const exactSymbol = results.find((asset) => asset.symbol.toUpperCase() === upper);
  if (exactSymbol) return { input: normalized, symbol: exactSymbol.symbol.toUpperCase(), name: exactSymbol.name, ambiguous: false, candidates: results.slice(0, 5).map(candidate), reason: "EXACT_SYMBOL" };
  const exactName = results.find((asset) => asset.name.trim().toLowerCase() === normalized.toLowerCase());
  if (exactName) return { input: normalized, symbol: exactName.symbol.toUpperCase(), name: exactName.name, ambiguous: false, candidates: results.slice(0, 5).map(candidate), reason: "EXACT_NAME" };
  if (results.length === 1) return { input: normalized, symbol: results[0].symbol.toUpperCase(), name: results[0].name, ambiguous: false, candidates: results.map(candidate), reason: "TOP_SEARCH_RESULT" };
  if (results.length > 1) return { input: normalized, symbol: null, name: null, ambiguous: true, candidates: results.slice(0, 5).map(candidate), reason: "AMBIGUOUS" };
  return { input: normalized, symbol: null, name: null, ambiguous: false, candidates: [], reason: "NOT_FOUND" };
}

export async function resolveEntities(inputs: string[], context?: Pick<AssistantToolContext, "provider">) {
  return Promise.all(inputs.map((input) => resolveEntity(input, context)));
}

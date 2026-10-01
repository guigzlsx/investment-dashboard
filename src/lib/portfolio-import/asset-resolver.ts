import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMarketDataProvider } from "../market-data/server";
import type { Database } from "../supabase/database.types";
import { findAssetByIsin, listAssetsBySymbol } from "../supabase/repositories";
import type { Currency } from "../portfolio/types";
import type { AssetResolution, AssetResolutionCandidate, NormalizedImportedTransaction } from "./types";

type ImportSupabase = SupabaseClient<Database>;

function currency(value: unknown): Currency | null {
  const normalized = typeof value === "string" ? value.toUpperCase() : "";
  return normalized === "EUR" || normalized === "USD" || normalized === "GBP" || normalized === "CHF" ? normalized : null;
}

function candidate(row: { id: string; symbol: string; name: string; isin?: string | null; exchange?: string | null; currency?: string | null; asset_type?: "STOCK" | "ETF" | null }): AssetResolutionCandidate {
  return { id: row.id, symbol: row.symbol, name: row.name, isin: row.isin ?? null, exchange: row.exchange ?? null, currency: currency(row.currency), assetType: row.asset_type ?? null };
}

function matchesContext(item: AssetResolutionCandidate, row: NormalizedImportedTransaction) {
  const exchangeMatches = !row.exchange || !item.exchange || item.exchange.toUpperCase() === row.exchange.toUpperCase();
  const currencyMatches = !row.currency || !item.currency || item.currency === row.currency;
  return exchangeMatches && currencyMatches;
}

export class AssetResolver {
  private readonly memo = new Map<string, Promise<AssetResolution>>();

  constructor(private readonly supabase: ImportSupabase) {}

  resolve(row: NormalizedImportedTransaction) {
    const key = [row.isin, row.symbol, row.name, row.exchange, row.currency].map((value) => value?.toUpperCase() ?? "").join("|");
    const existing = this.memo.get(key);
    if (existing) return existing;
    const result = this.resolveUncached(row);
    this.memo.set(key, result);
    return result;
  }

  private async resolveUncached(row: NormalizedImportedTransaction): Promise<AssetResolution> {
    const input = row.assetIdentifier;
    if (row.isin) {
      const match = await findAssetByIsin(this.supabase, row.isin);
      if (match) return { input, symbol: match.symbol, name: match.name, isin: match.isin, exchange: match.exchange, assetId: match.id, confidence: "HIGH", candidates: [candidate(match)], requiresReview: false, reason: "ISIN_MATCH" };
    }

    if (row.symbol) {
      const existing = (await listAssetsBySymbol(this.supabase, row.symbol)).map(candidate).filter((item) => matchesContext(item, row));
      if (existing.length === 1) {
        const match = existing[0];
        return { input, symbol: match.symbol, name: match.name, isin: match.isin ?? row.isin, exchange: match.exchange ?? row.exchange, assetId: match.id ?? null, confidence: row.isin ? "HIGH" : "HIGH", candidates: existing, requiresReview: false, reason: "EXISTING_ASSET" };
      }
      if (existing.length > 1) return { input, symbol: row.symbol, name: row.name, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: existing, requiresReview: true, reason: "AMBIGUOUS" };
    }

    const query = row.symbol ?? row.name ?? row.isin;
    if (!query) return { input, symbol: null, name: null, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: [], requiresReview: true, reason: "NOT_FOUND" };
    let matches = await getMarketDataProvider().searchAssets(query);
    if (row.symbol) matches = matches.filter((item) => item.symbol.toUpperCase() === row.symbol?.toUpperCase());
    const candidates = matches.map((item) => ({ symbol: item.symbol, name: item.name, isin: item.isin ?? row.isin, exchange: item.exchange, currency: item.currency, assetType: item.assetType } satisfies AssetResolutionCandidate)).filter((item) => matchesContext(item, row));
    if (candidates.length === 1) {
      const match = candidates[0];
      return { input, symbol: match.symbol, name: match.name, isin: match.isin ?? null, exchange: match.exchange ?? null, assetId: null, confidence: row.symbol ? "HIGH" : "MEDIUM", candidates, requiresReview: false, reason: "PROVIDER_SEARCH" };
    }
    return { input, symbol: row.symbol, name: row.name, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates, requiresReview: true, reason: candidates.length ? "AMBIGUOUS" : "NOT_FOUND" };
  }
}

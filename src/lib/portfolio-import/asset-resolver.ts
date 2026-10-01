import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getMarketDataProvider } from "../market-data/server";
import { MarketDataProviderError } from "../market-data/errors";
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

function normalizeSymbol(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? "";
}

function isTickerListing(symbol: string, requestedSymbol: string) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedRequested = normalizeSymbol(requestedSymbol);
  return normalizedSymbol === normalizedRequested || normalizedSymbol.startsWith(`${normalizedRequested}.`);
}

function resolutionTrace(values: Partial<NonNullable<AssetResolution["trace"]>> = {}): NonNullable<AssetResolution["trace"]> {
  return {
    existingIsin: values.existingIsin ?? "SKIPPED",
    existingTicker: values.existingTicker ?? "SKIPPED",
    providerQuery: values.providerQuery ?? null,
    providerResults: values.providerResults ?? 0,
    tickerResults: values.tickerResults ?? 0,
    contextResults: values.contextResults ?? 0,
  };
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
    let existingIsin: NonNullable<AssetResolution["trace"]>["existingIsin"] = row.isin ? "NOT_FOUND" : "SKIPPED";
    let existingTicker: NonNullable<AssetResolution["trace"]>["existingTicker"] = row.symbol ? "NOT_FOUND" : "SKIPPED";
    if (row.isin) {
      const match = await findAssetByIsin(this.supabase, row.isin);
      if (match) {
        existingIsin = "MATCH";
        return { input, symbol: match.symbol, name: match.name, isin: match.isin, exchange: match.exchange, assetId: match.id, confidence: "HIGH", candidates: [candidate(match)], requiresReview: false, reason: "ISIN_MATCH", trace: resolutionTrace({ existingIsin, providerQuery: null }) };
      }
    }

    if (row.symbol) {
      const existing = (await listAssetsBySymbol(this.supabase, row.symbol)).map(candidate).filter((item) => matchesContext(item, row));
      if (existing.length === 1) {
        existingTicker = "MATCH";
        const match = existing[0];
        return { input, symbol: match.symbol, name: match.name, isin: match.isin ?? row.isin, exchange: match.exchange ?? row.exchange, assetId: match.id ?? null, confidence: "HIGH", candidates: existing, requiresReview: false, reason: "EXISTING_ASSET", trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: null }) };
      }
      if (existing.length > 1) {
        existingTicker = "AMBIGUOUS";
        return { input, symbol: row.symbol, name: row.name, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: existing, requiresReview: true, reason: "AMBIGUOUS", trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: null, contextResults: existing.length }) };
      }
    }

    const query = row.symbol ?? row.name ?? row.isin;
    if (!query) return { input, symbol: null, name: null, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: [], requiresReview: true, reason: "NOT_FOUND", trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: null }) };

    let matches;
    try {
      matches = await getMarketDataProvider().searchAssets(query);
    } catch (error) {
      if (error instanceof MarketDataProviderError) {
        return { input, symbol: row.symbol, name: row.name, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: [], requiresReview: true, reason: "PROVIDER_ERROR", providerErrorCode: error.code, trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: query }) };
      }
      throw error;
    }

    const providerResults = matches.length;
    const exactMatches = row.symbol ? matches.filter((item) => normalizeSymbol(item.symbol) === normalizeSymbol(row.symbol)) : matches;
    const listingMatches = row.symbol && exactMatches.length === 0 ? matches.filter((item) => isTickerListing(item.symbol, row.symbol as string)) : exactMatches;
    const candidates = listingMatches.map((item) => ({ symbol: item.symbol, name: item.name, isin: item.isin ?? row.isin, exchange: item.exchange, currency: item.currency, assetType: item.assetType } satisfies AssetResolutionCandidate)).filter((item) => matchesContext(item, row));
    const existingProviderCandidates = row.symbol && exactMatches.length === 0
      ? (await Promise.all(candidates.map(async (item) => (await listAssetsBySymbol(this.supabase, item.symbol)).map(candidate).filter((existing) => matchesContext(existing, row))))).flat().filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
      : [];
    if (existingProviderCandidates.length === 1) {
      const match = existingProviderCandidates[0];
      return { input, symbol: match.symbol, name: match.name, isin: match.isin ?? row.isin, exchange: match.exchange ?? row.exchange, assetId: match.id ?? null, confidence: "HIGH", candidates: existingProviderCandidates, requiresReview: false, reason: "EXISTING_ASSET", trace: resolutionTrace({ existingIsin, existingTicker: "MATCH", providerQuery: query, providerResults, tickerResults: listingMatches.length, contextResults: candidates.length }) };
    }
    const resolvedCandidates = existingProviderCandidates.length > 1 ? existingProviderCandidates : candidates;
    if (resolvedCandidates.length === 1) {
      const match = resolvedCandidates[0];
      return { input, symbol: match.symbol, name: match.name, isin: match.isin ?? null, exchange: match.exchange ?? null, assetId: null, confidence: row.symbol && exactMatches.length === 1 ? "HIGH" : "MEDIUM", candidates, requiresReview: false, reason: "PROVIDER_SEARCH", trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: query, providerResults, tickerResults: listingMatches.length, contextResults: candidates.length }) };
    }
    const reason = resolvedCandidates.length > 1
      ? "AMBIGUOUS"
      : listingMatches.length > 0
        ? "UNSUPPORTED_ASSET"
        : providerResults > 0
          ? "INVALID_SYMBOL"
          : "NOT_FOUND";
    return { input, symbol: row.symbol, name: row.name, isin: row.isin, exchange: row.exchange, assetId: null, confidence: "LOW", candidates: resolvedCandidates, requiresReview: true, reason, trace: resolutionTrace({ existingIsin, existingTicker, providerQuery: query, providerResults, tickerResults: listingMatches.length, contextResults: candidates.length }) };
  }
}

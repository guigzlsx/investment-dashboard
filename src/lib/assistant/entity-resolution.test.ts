import { describe, expect, it } from "vitest";
import type { Asset } from "../market-data/models";
import type { MarketDataProvider } from "../market-data/provider";
import { resolveEntity } from "./entity-resolution";

const provenance = { source: "FMP", sourceEndpoint: "search", timestamp: "2026-10-01T00:00:00.000Z", asOfDate: "2026-10-01", dataKind: "EOD" as const, freshness: "FRESH" as const };
const asset = (symbol: string, name: string): Asset => ({ symbol, name, exchange: "NASDAQ", exchangeName: "NASDAQ", currency: "USD", assetType: "STOCK", country: "US", sector: null, industry: null, logoUrl: null, provenance });

function provider(results: Asset[]): MarketDataProvider {
  return { searchAssets: async () => results, getQuote: async () => { throw new Error("unused"); }, getHistoricalPrices: async () => [], getCompanyProfile: async () => { throw new Error("unused"); }, getFinancials: async () => [], getKeyMetrics: async () => [] };
}

describe("entity resolution", () => {
  it("resolves a ticker and a company name through provider search", async () => {
    expect((await resolveEntity("NVDA", { provider: provider([asset("NVDA", "NVIDIA Corporation")]) })).symbol).toBe("NVDA");
    expect((await resolveEntity("NVIDIA", { provider: provider([asset("NVDA", "NVIDIA")]) })).reason).toBe("EXACT_NAME");
  });

  it("keeps ambiguous provider results unresolved", async () => {
    const result = await resolveEntity("Apple companies", { provider: provider([asset("AAPL", "Apple"), asset("APLE", "Apple Hospitality")]) });
    expect(result.symbol).toBeNull();
    expect(result.ambiguous).toBe(true);
    expect(result.candidates).toHaveLength(2);
  });
});

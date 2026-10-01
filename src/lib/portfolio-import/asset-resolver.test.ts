import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetResolver } from "./asset-resolver";
import type { NormalizedImportedTransaction } from "./types";
import { findAssetByIsin, listAssetsBySymbol } from "../supabase/repositories";

vi.mock("../supabase/repositories", () => ({ findAssetByIsin: vi.fn(), listAssetsBySymbol: vi.fn() }));
vi.mock("../market-data/server", () => ({ getMarketDataProvider: vi.fn() }));

const row = (values: Partial<NormalizedImportedTransaction>): NormalizedImportedTransaction => ({ sourceRow: 2, assetIdentifier: "NVDA", symbol: "NVDA", name: null, isin: null, exchange: null, assetId: null, assetType: null, transactionType: "BUY", quantity: 1, price: 100, currency: "USD", fees: 0, transactionDate: "2026-01-15T00:00:00.000Z", fxRateToBase: null, confidence: "MEDIUM", warnings: [], errors: [], status: "READY", possibleDuplicate: false, assetResolution: null, ...values });

describe("portfolio import asset resolution", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(findAssetByIsin).mockResolvedValue(null); vi.mocked(listAssetsBySymbol).mockResolvedValue([]); });

  it("prefers an exact ISIN match", async () => {
    vi.mocked(findAssetByIsin).mockResolvedValue({ id: "asset-1", symbol: "NVDA", name: "NVIDIA", isin: "US67066G1040", exchange: "NASDAQ", currency: "USD", asset_type: "STOCK" });
    const result = await new AssetResolver({} as never).resolve(row({ assetIdentifier: "US67066G1040", symbol: null, isin: "US67066G1040" }));
    expect(result).toMatchObject({ assetId: "asset-1", confidence: "HIGH", reason: "ISIN_MATCH", requiresReview: false });
  });

  it("does not silently choose between same-ticker assets", async () => {
    vi.mocked(listAssetsBySymbol).mockResolvedValue([
      { id: "asset-1", symbol: "ABC", name: "ABC US", isin: null, exchange: "NYSE", currency: "USD", asset_type: "STOCK" },
      { id: "asset-2", symbol: "ABC", name: "ABC London", isin: null, exchange: "LSE", currency: "GBP", asset_type: "STOCK" },
    ]);
    const result = await new AssetResolver({} as never).resolve(row({ assetIdentifier: "ABC", symbol: "ABC", currency: null }));
    expect(result).toMatchObject({ assetId: null, requiresReview: true, reason: "AMBIGUOUS", confidence: "LOW" });
  });
});

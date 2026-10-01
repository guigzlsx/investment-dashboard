import { describe, expect, it } from "vitest";
import { importRowAction } from "./presentation";
import type { NormalizedImportedTransaction } from "./types";

const baseRow: NormalizedImportedTransaction = {
  sourceRow: 2, assetIdentifier: "STX", symbol: "STX", name: "Seagate Technology Holdings plc", isin: null, exchange: "NASDAQ", assetId: null, assetType: "STOCK",
  transactionType: "BUY", quantity: 1, price: 100, currency: "USD", fees: 0, transactionDate: "2026-01-01T00:00:00.000Z", fxRateToBase: 1,
  confidence: "HIGH", warnings: [], errors: [], status: "READY", possibleDuplicate: false, assetResolution: null,
};

describe("portfolio import presentation actions", () => {
  it("does not offer an asset choice for a ready row", () => {
    expect(importRowAction(baseRow)).toBe("NONE");
  });

  it("offers asset choice only for an ambiguous resolution with candidates", () => {
    expect(importRowAction({ ...baseRow, status: "ERROR", errors: ["Asset resolution is ambiguous"], assetResolution: { input: "VUAA", symbol: "VUAA", name: null, isin: null, exchange: null, assetId: null, confidence: "LOW", requiresReview: true, reason: "AMBIGUOUS", candidates: [{ symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", currency: "EUR", assetType: "ETF" }] } })).toBe("CHOOSE_ASSET");
  });

  it("offers retry rather than asset choice for a provider failure", () => {
    expect(importRowAction({ ...baseRow, status: "ERROR", errors: ["Market data provider is temporarily unavailable; try again"], assetResolution: { input: "STX", symbol: "STX", name: null, isin: null, exchange: null, assetId: null, confidence: "LOW", requiresReview: true, reason: "PROVIDER_ERROR", providerErrorCode: "RATE_LIMIT", candidates: [] } })).toBe("RETRY");
  });
});

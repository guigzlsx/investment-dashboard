import { describe, expect, it } from "vitest";
import { applySelection } from "./service";
import type { NormalizedImportedTransaction } from "./types";

function row(): NormalizedImportedTransaction {
  return {
    sourceRow: 2, assetIdentifier: "VUAA", symbol: "VUAA", name: null, isin: null, exchange: null, assetId: null, assetType: null,
    transactionType: "BUY", quantity: 1, price: 100, currency: "EUR", fees: 0, transactionDate: "2026-01-01T00:00:00.000Z", fxRateToBase: 1,
    confidence: "LOW", warnings: [], errors: ["Asset resolution is ambiguous; choose a matching asset"], status: "ERROR", possibleDuplicate: false,
    assetResolution: { input: "VUAA", symbol: "VUAA", name: null, isin: null, exchange: null, assetId: null, confidence: "LOW", requiresReview: true, reason: "AMBIGUOUS", candidates: [{ symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", currency: "EUR", assetType: "ETF" }] },
  };
}

describe("portfolio import asset selection", () => {
  it("turns a selected provider candidate into a ready row", () => {
    const imported = row();
    applySelection(imported, "VUAA.MI|MIL");
    expect(imported).toMatchObject({ symbol: "VUAA.MI", name: "Vanguard S&P 500 UCITS ETF", exchange: "MIL", assetType: "ETF", status: "READY", errors: [] });
    expect(imported.assetResolution).toMatchObject({ requiresReview: false, confidence: "HIGH", reason: "EXISTING_ASSET" });
  });
});

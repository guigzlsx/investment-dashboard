import { describe, expect, it } from "vitest";
import type { PortfolioTransaction } from "../portfolio/types";
import { markImportDuplicates, summarizeImportRows } from "./validator";
import { normalizeImportRows } from "./normalizer";

const mapping = { Date: "date" as const, Type: "transactionType" as const, Ticker: "ticker" as const, Quantity: "quantity" as const, Price: "price" as const, Currency: "currency" as const };

describe("portfolio import duplicate protection", () => {
  it("marks an existing transaction and a repeated row as possible duplicates", () => {
    const rows = normalizeImportRows([
      { Date: "2026-01-15", Type: "BUY", Ticker: "NVDA", Quantity: "0.25", Price: "180", Currency: "EUR" },
      { Date: "2026-01-15", Type: "BUY", Ticker: "NVDA", Quantity: "0.25", Price: "180", Currency: "EUR" },
    ], mapping);
    rows.forEach((row) => { row.assetId = "asset-1"; row.symbol = "NVDA"; row.name = "NVIDIA"; });
    const existing = [{ assetId: "asset-1", symbol: "NVDA", type: "BUY", quantity: 0.25, unitPrice: 180, currency: "EUR", executedAt: "2026-01-15T00:00:00.000Z" } as PortfolioTransaction];
    markImportDuplicates(rows, existing);
    expect(rows.every((row) => row.possibleDuplicate)).toBe(true);
    expect(summarizeImportRows(rows).duplicates).toBe(2);
  });
});

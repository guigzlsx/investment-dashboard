import { describe, expect, it } from "vitest";
import type { PortfolioTransaction } from "./types";
import { transactionsForPosition } from "./removal";

const transaction = (overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction => ({
  id: "transaction-1",
  portfolioId: "portfolio-a",
  assetId: "asset-nvda",
  symbol: "NVDA",
  type: "BUY",
  quantity: 1,
  unitPrice: 100,
  currency: "USD",
  fees: 0,
  executedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("portfolio position removal selection", () => {
  it("selects a single BUY transaction", () => {
    expect(transactionsForPosition([transaction()], "portfolio-a", "asset-nvda")).toHaveLength(1);
  });

  it("selects multiple BUY transactions and a BUY plus SELL history", () => {
    const rows = [
      transaction(),
      transaction({ id: "transaction-2", type: "BUY", quantity: 0.25 }),
      transaction({ id: "transaction-3", type: "SELL", quantity: 0.5 }),
    ];
    expect(transactionsForPosition(rows, "portfolio-a", "asset-nvda")).toHaveLength(3);
  });

  it("does not select another asset or another portfolio row", () => {
    const rows = [
      transaction(),
      transaction({ id: "transaction-2", assetId: "asset-amzn", symbol: "AMZN" }),
      transaction({ id: "transaction-3", portfolioId: "portfolio-b" }),
    ];
    expect(transactionsForPosition(rows, "portfolio-a", "asset-nvda").map((row) => row.id)).toEqual(["transaction-1"]);
  });

  it("returns no rows for an already removed position", () => {
    expect(transactionsForPosition([], "portfolio-a", "asset-nvda")).toEqual([]);
  });
});

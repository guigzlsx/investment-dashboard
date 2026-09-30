import { describe, expect, it } from "vitest";
import { calculatePositions, PortfolioCalculationError, valuePositions } from "./calculations";
import type { PortfolioTransaction } from "./types";

function transaction(overrides: Partial<PortfolioTransaction>): PortfolioTransaction {
  return {
    id: crypto.randomUUID(),
    symbol: "TEST",
    type: "BUY",
    quantity: 1,
    unitPrice: 100,
    currency: "EUR",
    fees: 0,
    executedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("portfolio calculations", () => {
  it("calculates a weighted average across multiple buys", () => {
    const positions = calculatePositions([
      transaction({ id: "buy-1", unitPrice: 100 }),
      transaction({ id: "buy-2", unitPrice: 120, executedAt: "2026-01-02T10:00:00.000Z" }),
    ]);

    expect(positions[0]).toMatchObject({ quantity: 2, averagePrice: 110, costBasis: 220 });
  });

  it("keeps the remaining average cost after a sell and records realized P/L", () => {
    const positions = calculatePositions([
      transaction({ id: "buy-1", unitPrice: 100 }),
      transaction({ id: "buy-2", unitPrice: 120, executedAt: "2026-01-02T10:00:00.000Z" }),
      transaction({ id: "sell-1", type: "SELL", quantity: 1, unitPrice: 150, executedAt: "2026-01-03T10:00:00.000Z" }),
    ]);

    expect(positions[0]).toMatchObject({ quantity: 1, averagePrice: 110, costBasis: 110, realizedPnl: 40 });
  });

  it("does not mix currencies without an explicit FX rate", () => {
    expect(() => calculatePositions([transaction({ currency: "USD" })])).toThrow(PortfolioCalculationError);
  });

  it("separates asset performance from the FX conversion used for valuation", () => {
    const positions = calculatePositions([transaction({ symbol: "USD-ASSET", currency: "USD", fxRateToBase: 0.9 })]);
    const summary = valuePositions(
      positions,
      new Map([["USD-ASSET", { symbol: "USD-ASSET", price: 100, currency: "USD", change1D: 2 }]]),
      [{ fromCurrency: "USD", toCurrency: "EUR", rate: 0.92, asOfDate: "2026-09-30", timestamp: "2026-09-30T12:00:00.000Z", source: "test" }],
      "EUR",
    );

    expect(summary.investedCost).toBe(90);
    expect(summary.currentValue).toBe(92);
    expect(summary.pnl).toBe(2);
    expect(summary.dataQuality).toBe("COMPLETE");
  });
});

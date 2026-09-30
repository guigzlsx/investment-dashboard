import { describe, expect, it } from "vitest";
import { calculatePerformanceHistory } from "./history";
import type { PortfolioSnapshot, PortfolioTransaction } from "./types";

const snapshot = (capturedAt: string, portfolioValue: number): PortfolioSnapshot => ({ portfolioId: "portfolio", capturedAt, portfolioValue, investedCapital: portfolioValue, unrealizedPnl: 0, cash: 0, currency: "EUR", dataQuality: "COMPLETE" });

describe("performance history", () => {
  it("does not treat a deposit as investment performance", () => {
    const transactions: PortfolioTransaction[] = [{ id: "deposit", symbol: "CASH", type: "DEPOSIT", quantity: null, unitPrice: 100, currency: "EUR", fees: 0, executedAt: "2026-01-02T10:00:00.000Z" }];
    const points = calculatePerformanceHistory([snapshot("2026-01-01T10:00:00.000Z", 100), snapshot("2026-01-03T10:00:00.000Z", 200)], transactions);
    expect(points[1].netCashFlow).toBe(100);
    expect(points[1].periodReturnPercent).toBe(0);
    expect(points[1].performancePercent).toBe(0);
  });
});

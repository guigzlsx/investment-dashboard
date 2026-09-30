import { describe, expect, it } from "vitest";
import { analyzeGrowth, analyzeValuation } from "./fundamentals";
import type { FinancialStatement, KeyMetrics } from "../market-data/models";

const statement = (period: string, revenue: number, eps: number, freeCashFlow: number): FinancialStatement => ({ symbol: "TEST", period, periodEnd: `${period}-12-31`, reportedCurrency: "USD", revenue, grossProfit: revenue * 0.5, operatingIncome: revenue * 0.2, netIncome: revenue * 0.1, eps, operatingCashFlow: freeCashFlow, freeCashFlow, totalDebt: 0, cash: 0, provenance: { source: "test", sourceEndpoint: "test", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: `${period}-12-31`, dataKind: "EOD", freshness: "FRESH" } });

const metric = (period: string, pe: number): KeyMetrics => ({ symbol: "TEST", period, periodEnd: `${period}-12-31`, marketCap: null, pe, forwardPe: null, peg: null, priceToSales: null, evToEbitda: null, grossMargin: null, operatingMargin: null, netMargin: null, debtToEquity: null, revenueGrowth: null, fcfYield: null, roic: null, roe: null, provenance: { source: "test", sourceEndpoint: "test", timestamp: "2026-01-01T00:00:00.000Z", asOfDate: `${period}-12-31`, dataKind: "EOD", freshness: "FRESH" } });

describe("fundamental analysis", () => {
  it("classifies growth acceleration with a defined threshold", () => {
    const result = analyzeGrowth([statement("2023", 100, 1, 10), statement("2024", 120, 1.2, 12), statement("2025", 150, 1.6, 18)]);
    expect(result.revenueTrend).toBe("ACCELERATING");
    expect(result.points[2].revenueGrowth).toBeCloseTo(0.25);
  });

  it("computes valuation median and relative context", () => {
    const result = analyzeValuation([metric("2023", 20), metric("2024", 30), metric("2025", 40)]);
    expect(result.metrics[0]).toMatchObject({ current: 40, median: 30, minimum: 20, maximum: 40 });
    expect(result.metrics[0].relativeToMedian).toBeCloseTo(1 / 3, 10);
  });
});

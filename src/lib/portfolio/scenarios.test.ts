import { describe, expect, it } from "vitest";
import { calculateFxScenario, calculateScenario } from "./scenarios";
import type { PortfolioSummary } from "./types";

const summary: PortfolioSummary = { baseCurrency: "EUR", investedCost: 163, currentValue: 163, pnl: 0, performance: 0, dailyChange: 0, dataQuality: "COMPLETE", positions: [{ symbol: "NVDA", quantity: 1, averagePrice: 163, averagePriceCurrency: "EUR", quoteCurrency: "USD", transactionCurrencies: ["USD"], costBasis: 163, realizedPnl: 0, currentValue: 86.39, weight: 0.53, assetType: "STOCK" }, { symbol: "OTHER", quantity: 1, averagePrice: 76.61, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 76.61, realizedPnl: 0, currentValue: 76.61, weight: 0.47, assetType: "STOCK" }] };

describe("scenario calculations", () => {
  it("uses the real position weight for an asset shock", () => {
    const result = calculateScenario(summary, [{ key: "NVDA", label: "NVDA", shock: -0.2 }]);
    expect(result.impactPercent).toBeCloseTo(-0.106, 3);
    expect(result.estimatedValue).toBeCloseTo(145.722, 3);
  });

  it("isolates FX exposure from the asset price", () => {
    const result = calculateFxScenario(summary, "USD", -0.1);
    expect(result.impact).toBeCloseTo(-8.639, 3);
    expect(result.impactPercent).toBeCloseTo(-0.053, 3);
  });
});

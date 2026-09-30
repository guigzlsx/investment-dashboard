import { describe, expect, it } from "vitest";
import { portfolioInsightEngine } from "./engine";

describe("PortfolioInsightEngine", () => {
  it("flags a concentrated position using current weight", () => {
    const insights = portfolioInsightEngine.generate({ baseCurrency: "EUR", investedCost: 100, currentValue: 100, pnl: 0, performance: 0, dailyChange: 0, dataQuality: "COMPLETE", positions: [{ symbol: "TEST", quantity: 1, averagePrice: 100, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 100, realizedPnl: 0, weight: 0.53, assetType: "STOCK", sector: "Technology" }] });
    expect(insights[0]).toMatchObject({ type: "CONCENTRATION", severity: "HIGH" });
    expect(insights[0].evidence[0]).toMatchObject({ label: "Portfolio weight", value: "53%" });
  });

  it("flags limited ETF exposure without inventing a recommendation", () => {
    const insights = portfolioInsightEngine.generate({ baseCurrency: "EUR", investedCost: 100, currentValue: null, pnl: null, performance: null, dailyChange: null, dataQuality: "PARTIAL", positions: [{ symbol: "TEST", quantity: 1, averagePrice: 100, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 100, realizedPnl: 0, weight: null, assetType: "STOCK" }] });
    expect(insights.some((insight) => insight.type === "ETF_EXPOSURE")).toBe(true);
    expect(insights.find((insight) => insight.type === "ETF_EXPOSURE")?.description).toContain("not a recommendation");
  });
});

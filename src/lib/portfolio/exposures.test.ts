import { describe, expect, it } from "vitest";
import { buildPortfolioHealth, calculateExposure } from "./exposures";
import type { PortfolioSummary } from "./types";

const summary: PortfolioSummary = { baseCurrency: "EUR", investedCost: 100, currentValue: 100, pnl: 0, performance: 0, dailyChange: 0, dataQuality: "COMPLETE", positions: [{ symbol: "NVDA", quantity: 1, averagePrice: 53, averagePriceCurrency: "EUR", quoteCurrency: "USD", transactionCurrencies: ["USD"], costBasis: 53, realizedPnl: 0, currentValue: 53, weight: 0.53, assetType: "STOCK", sector: "Technology", country: "US", themes: ["AI Infrastructure"] }, { symbol: "ETF", quantity: 1, averagePrice: 47, averagePriceCurrency: "EUR", quoteCurrency: "EUR", transactionCurrencies: ["EUR"], costBasis: 47, realizedPnl: 0, currentValue: 47, weight: 0.47, assetType: "ETF", sector: "Diversified", country: "US", themes: ["Broad Equity"] }] };

describe("portfolio exposures", () => {
  it("calculates concentration and theme exposure without a score", () => {
    expect(calculateExposure(summary, "company")[0]).toMatchObject({ key: "NVDA", percent: 0.53 });
    expect(buildPortfolioHealth(summary).themes[0]).toMatchObject({ key: "AI Infrastructure", percent: 0.53 });
  });
});

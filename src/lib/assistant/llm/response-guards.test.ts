import { describe, expect, it } from "vitest";
import { guardFinancialAnswer } from "./response-guards";

describe("assistant response guards", () => {
  it("flags a financial number that is absent from tool data", () => {
    const text = guardFinancialAnswer("The portfolio value is 9999 EUR.", [{ name: "getPortfolioSummary", input: {}, result: { success: true, data: { currentValue: 1000 }, provenance: [], generatedAt: new Date().toISOString(), missingData: [] } }]);
    expect(text).toContain("could not be matched");
  });

  it("does not add a warning when the cited number exists in tool data", () => {
    expect(guardFinancialAnswer("The portfolio value is 1000 EUR.", [{ name: "getPortfolioSummary", input: {}, result: { success: true, data: { currentValue: 1000 }, provenance: [], generatedAt: new Date().toISOString(), missingData: [] } }])).not.toContain("could not be matched");
  });
});


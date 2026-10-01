import { describe, expect, it } from "vitest";
import { extractEntityQueries, extractScenarioChange, routeAssistantIntent } from "./intent-router";

describe("AssistantIntentRouter", () => {
  it("routes the required portfolio and asset questions", () => {
    expect(routeAssistantIntent("Analyse mon portefeuille").intent).toBe("PORTFOLIO_OVERVIEW");
    expect(routeAssistantIntent("What are my main risks?").intent).toBe("PORTFOLIO_RISK");
    expect(routeAssistantIntent("Analyze NVIDIA").intent).toBe("ASSET_ANALYSIS");
    expect(routeAssistantIntent("Analyze NVIDIA in my portfolio").intent).toBe("POSITION_ANALYSIS");
    expect(routeAssistantIntent("Compare NVIDIA and Marvell").intent).toBe("COMPARISON");
    expect(routeAssistantIntent("What if NVIDIA falls 20%?").intent).toBe("SCENARIO");
    expect(routeAssistantIntent("What is forward P/E?").intent).toBe("EDUCATION");
  });

  it("extracts scenario values and entity queries without a company list", () => {
    expect(extractScenarioChange("What if NVIDIA falls -20%?")).toBe(-20);
    expect(extractEntityQueries("Compare NVIDIA and Marvell", "COMPARISON")).toEqual(["NVIDIA", "Marvell"]);
    expect(extractEntityQueries("What if NVIDIA falls 20%", "SCENARIO")).toEqual(["NVIDIA"]);
  });
});

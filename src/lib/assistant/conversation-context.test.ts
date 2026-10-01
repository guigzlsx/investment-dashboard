import { describe, expect, it } from "vitest";
import { conversationalEntityQueries, conversationalIntent } from "./conversation-context";

describe("assistant conversation context", () => {
  it("resolves an asset follow-up as an asset analysis", () => {
    const detection = conversationalIntent("What about Marvell?", { symbols: ["NVDA"], previousIntent: "ASSET_ANALYSIS" });
    expect(detection.intent).toBe("ASSET_ANALYSIS");
    expect(conversationalEntityQueries("What about Marvell?", detection.intent, { symbols: ["NVDA"], previousIntent: "ASSET_ANALYSIS" })).toEqual(["Marvell"]);
  });

  it("reuses the two prior subjects for a pronoun comparison", () => {
    const state = { symbols: ["NVDA", "MRVL"], previousIntent: "ASSET_ANALYSIS" as const };
    const detection = conversationalIntent("Compare them", state);
    expect(detection.intent).toBe("COMPARISON");
    expect(conversationalEntityQueries("Compare them", detection.intent, state)).toEqual(["NVDA", "MRVL"]);
  });

  it("routes a decision question to position analysis", () => {
    expect(conversationalIntent("Should I add more NVIDIA?", { symbols: [], previousIntent: null }).intent).toBe("POSITION_ANALYSIS");
  });
});


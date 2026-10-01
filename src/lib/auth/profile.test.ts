import { describe, expect, it } from "vitest";
import { displayNameForUser, initialsForUser, parseProfileUpdate } from "./profile";

describe("profile preferences", () => {
  it("normalizes an update without accepting a user id", () => {
    expect(parseProfileUpdate({ displayName: "  Guillaume  ", baseCurrency: "USD", defaultAnalysisDepth: "DETAILED", id: "other-user" })).toEqual({
      displayName: "Guillaume",
      baseCurrency: "USD",
      defaultAnalysisDepth: "DETAILED",
    });
  });

  it("rejects invalid preferences", () => {
    expect(() => parseProfileUpdate({ baseCurrency: "JPY" })).toThrow("Base currency is invalid");
    expect(() => parseProfileUpdate({ defaultAnalysisDepth: "FULL" })).toThrow("Analysis depth is invalid");
  });

  it("uses display name or email initials", () => {
    expect(displayNameForUser("Guillaume Le Saux", "user@example.com")).toBe("Guillaume Le Saux");
    expect(displayNameForUser(null, "user@example.com")).toBe("user");
    expect(initialsForUser("Guillaume Le Saux", "user@example.com")).toBe("GS");
    expect(initialsForUser(null, "user@example.com")).toBe("US");
  });
});

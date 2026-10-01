import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./messages";

describe("authentication messages", () => {
  it("maps common Supabase errors to user-facing messages", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toContain("incorrect");
    expect(authErrorMessage(new Error("Email not confirmed"))).toContain("not confirmed");
    expect(authErrorMessage(Object.assign(new Error("too many requests"), { status: 429 }))).toContain("Too many attempts");
  });
});

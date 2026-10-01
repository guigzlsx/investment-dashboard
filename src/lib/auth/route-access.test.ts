import { describe, expect, it } from "vitest";
import { getAuthRedirect } from "./route-access";

describe("auth route redirects", () => {
  it("sends an anonymous user from the root and private pages to login", () => {
    expect(getAuthRedirect("/", false)).toBe("/login");
    expect(getAuthRedirect("/dashboard", false)).toBe("/login");
    expect(getAuthRedirect("/portfolio", false)).toBe("/login");
    expect(getAuthRedirect("/profile", false)).toBe("/login");
  });

  it("sends an authenticated user from the root and login to dashboard", () => {
    expect(getAuthRedirect("/", true)).toBe("/dashboard");
    expect(getAuthRedirect("/login", true)).toBe("/dashboard");
    expect(getAuthRedirect("/dashboard", true)).toBeNull();
    expect(getAuthRedirect("/profile", true)).toBeNull();
  });

  it("leaves API requests to route handlers so anonymous calls receive 401", () => {
    expect(getAuthRedirect("/api/profile", false)).toBeNull();
  });
});

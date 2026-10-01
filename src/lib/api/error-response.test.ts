import { describe, expect, it } from "vitest";
import { errorResponse } from "./error-response";
import { AuthenticationRequiredError } from "../supabase/auth";

describe("API authentication errors", () => {
  it("returns 401 for requests without a session", async () => {
    const response = errorResponse(new AuthenticationRequiredError());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: { code: "AUTH_REQUIRED", message: "Authentication is required for personal portfolio data" } });
  });
});

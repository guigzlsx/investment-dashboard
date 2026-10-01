import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationRequiredError } from "../../../../../lib/supabase/auth";
import { POST } from "./route";

const getAuthenticatedSupabase = vi.hoisted(() => vi.fn());
vi.mock("../../../../../lib/supabase/auth", async () => ({
  ...(await vi.importActual<typeof import("../../../../../lib/supabase/auth")>("../../../../../lib/supabase/auth")),
  getAuthenticatedSupabase,
}));

const portfolioId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new Request("http://localhost/api/portfolio/positions/remove", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("remove position API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 before attempting the RPC without a session", async () => {
    getAuthenticatedSupabase.mockRejectedValue(new AuthenticationRequiredError());
    const response = await POST(request({ portfolioId, assetId }));
    expect(response.status).toBe(401);
  });

  it("passes only scoped portfolio and asset ids to the authenticated RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { state: "REMOVED", deletedTransactions: 3 }, error: null });
    getAuthenticatedSupabase.mockResolvedValue({ supabase: { rpc } });
    const response = await POST(request({ portfolioId, assetId, userId: "must-not-be-used" }));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("remove_portfolio_position", { p_portfolio_id: portfolioId, p_asset_id: assetId });
  });

  it("maps a repeated or unknown removal to a safe not-found response", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("POSITION_NOT_FOUND") });
    getAuthenticatedSupabase.mockResolvedValue({ supabase: { rpc } });
    const response = await POST(request({ portfolioId, assetId }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "POSITION_NOT_FOUND", message: "Position not found or already removed." } });
  });

  it("rejects malformed identifiers before calling Supabase", async () => {
    const rpc = vi.fn();
    getAuthenticatedSupabase.mockResolvedValue({ supabase: { rpc } });
    const response = await POST(request({ portfolioId: "not-a-uuid", assetId }));
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});

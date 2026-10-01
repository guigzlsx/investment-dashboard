import { describe, expect, it } from "vitest";
import { clearMemoryCache, withMemoryCache } from "./cache";

describe("market data cache", () => {
  it("does not retain an empty search result as a negative cache", async () => {
    let calls = 0;
    const key = `negative-search-${Date.now()}`;
    const first = await withMemoryCache(key, 60_000, async () => { calls += 1; return []; });
    const second = await withMemoryCache(key, 60_000, async () => { calls += 1; return [{ symbol: "NVDA" }]; });
    expect(first).toEqual([]);
    expect(second).toEqual([{ symbol: "NVDA" }]);
    expect(calls).toBe(2);
  });

  it("shares concurrent requests through single-flight", async () => {
    clearMemoryCache();
    let calls = 0;
    const loader = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { value: 1 };
    };
    await Promise.all(Array.from({ length: 10 }, () => withMemoryCache("single-flight", 1_000, loader)));
    expect(calls).toBe(1);
  });
});

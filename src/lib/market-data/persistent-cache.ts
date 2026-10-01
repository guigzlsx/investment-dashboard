import { createSupabaseAdminClient } from "../supabase/admin";
import type { Json } from "../supabase/database.types";
import { withMemoryCache } from "./cache";
import type { MarketDataProviderId } from "./models";

function asOfDate(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const provenance = record.provenance as Record<string, unknown> | undefined;
  return typeof provenance?.asOfDate === "string" ? provenance.asOfDate : null;
}

function isNegativeResult(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

function markCached<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => markCached(item)) as T;
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  if (!record.provenance || typeof record.provenance !== "object") return value;
  return { ...record, provenance: { ...(record.provenance as Record<string, unknown>), cacheStatus: "CACHED" } } as T;
}

export async function withPersistentMarketCache<T>(options: { key: string; resourceType: string; ttlMs: number; provider?: MarketDataProviderId; loader: () => Promise<T> }): Promise<T> {
  const provider = options.provider ?? "FMP";
  const memoryKey = `persistent:${options.key}`;
  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const cached = await admin.from("market_data_cache").select("payload, expires_at").eq("cache_key", options.key).eq("provider", provider).gt("expires_at", now).maybeSingle();
    if (!cached.error && cached.data?.payload !== undefined && !isNegativeResult(cached.data.payload)) return markCached(cached.data.payload as T);
  } catch {
    admin = null;
  }

  const value = await loaderWithMemory(options, memoryKey);
  if (admin && !isNegativeResult(value)) {
    try {
      await admin.from("market_data_cache").upsert({ cache_key: options.key, resource_type: options.resourceType, provider, payload: value as unknown as Json, as_of_date: asOfDate(value), fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + options.ttlMs).toISOString() }, { onConflict: "cache_key,provider" });
    } catch {
      // Cache persistence must never turn a valid provider result into an import failure.
    }
  }
  return value;
}

function loaderWithMemory<T>(options: { key: string; ttlMs: number; loader: () => Promise<T> }, memoryKey: string) {
  return withMemoryCache(memoryKey, options.ttlMs, options.loader);
}

import { createSupabaseAdminClient } from "../supabase/admin";
import type { Json } from "../supabase/database.types";
import { withMemoryCache } from "./cache";

function asOfDate(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const provenance = record.provenance as Record<string, unknown> | undefined;
  return typeof provenance?.asOfDate === "string" ? provenance.asOfDate : null;
}

export async function withPersistentMarketCache<T>(options: { key: string; resourceType: string; ttlMs: number; loader: () => Promise<T> }): Promise<T> {
  const memoryKey = `persistent:${options.key}`;
  try {
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const cached = await admin.from("market_data_cache").select("payload, expires_at").eq("cache_key", options.key).eq("provider", "FMP").gt("expires_at", now).maybeSingle();
    if (!cached.error && cached.data?.payload !== undefined) return cached.data.payload as T;
    const value = await loaderWithMemory(options, memoryKey);
    await admin.from("market_data_cache").upsert({ cache_key: options.key, resource_type: options.resourceType, provider: "FMP", payload: value as unknown as Json, as_of_date: asOfDate(value), fetched_at: new Date().toISOString(), expires_at: new Date(Date.now() + options.ttlMs).toISOString() }, { onConflict: "cache_key,provider" });
    return value;
  } catch {
    return loaderWithMemory(options, memoryKey);
  }
}

function loaderWithMemory<T>(options: { key: string; ttlMs: number; loader: () => Promise<T> }, memoryKey: string) {
  return withMemoryCache(memoryKey, options.ttlMs, options.loader);
}

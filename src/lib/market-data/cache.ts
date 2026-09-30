interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export async function withMemoryCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const value = await loader();
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export const MARKET_DATA_TTL_MS = {
  quote: 60_000,
  historicalPrices: 15 * 60_000,
  profile: 7 * 24 * 60 * 60_000,
  financials: 24 * 60 * 60_000,
  keyMetrics: 24 * 60 * 60_000,
  search: 5 * 60_000,
} as const;

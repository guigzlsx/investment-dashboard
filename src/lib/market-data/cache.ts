interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function isNegativeResult(value: unknown) {
  return Array.isArray(value) && value.length === 0;
}

export async function withMemoryCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    if (!isNegativeResult(existing.value)) return existing.value;
    memoryCache.delete(key);
  }

  const value = await withSingleFlight(key, loader);
  if (!isNegativeResult(value)) memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function withSingleFlight<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const request = Promise.resolve().then(loader);
  inFlight.set(key, request);
  void request.then(() => undefined, () => undefined).then(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  return request;
}

export function clearMemoryCache() {
  memoryCache.clear();
  inFlight.clear();
}

export const MARKET_DATA_TTL_MS = {
  quote: 60_000,
  historicalPrices: 15 * 60_000,
  profile: 7 * 24 * 60 * 60_000,
  financials: 24 * 60 * 60_000,
  keyMetrics: 24 * 60 * 60_000,
  search: 5 * 60_000,
} as const;

import type { MarketDataProviderId } from "./models";

export type MarketDataCapability = "QUOTE" | "HISTORY" | "PROFILE" | "FINANCIALS" | "METRICS" | "SEARCH";

const capabilityErrors = new Map<string, { code: string; expiresAt: number }>();

const TTL_MS: Record<string, number> = {
  PLAN_REQUIRED: 10 * 60_000,
  UNSUPPORTED_SYMBOL: 30 * 60_000,
  RATE_LIMIT: 30_000,
  NOT_FOUND: 5 * 60_000,
};

function key(provider: MarketDataProviderId, capability: MarketDataCapability, symbol: string) {
  return `${provider}:${capability}:${symbol.trim().toUpperCase()}`;
}

export function getNegativeCapability(provider: MarketDataProviderId, capability: MarketDataCapability, symbol: string) {
  const entry = capabilityErrors.get(key(provider, capability, symbol));
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) capabilityErrors.delete(key(provider, capability, symbol));
    return null;
  }
  return entry.code;
}

export function rememberNegativeCapability(provider: MarketDataProviderId, capability: MarketDataCapability, symbol: string, code: string) {
  const ttl = TTL_MS[code];
  if (!ttl) return;
  capabilityErrors.set(key(provider, capability, symbol), { code, expiresAt: Date.now() + ttl });
}

export function clearNegativeCapabilities() {
  capabilityErrors.clear();
}

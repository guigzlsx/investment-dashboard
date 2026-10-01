import type { MarketDataProviderId } from "./models";

export interface MarketDataAssetContext {
  symbol: string;
  exchange?: string | null;
  currency?: string | null;
  providerSymbols?: Record<string, unknown> | null;
}

const VALIDATED_EODHD_SYMBOLS: Record<string, string> = {
  ONON: "ONON.US",
  STX: "STX.US",
  "VUAA.DE": "VUAA.XETRA",
  "VUAA.L": "VUAA.LSE",
};

const US_EXCHANGES = new Set(["US", "NYSE", "NASDAQ", "NYSE ARCA", "NYSE AMERICAN", "NASDAQ GLOBAL SELECT MARKET"]);

function canonicalSymbol(asset: MarketDataAssetContext) {
  const symbol = asset.symbol.trim().toUpperCase();
  return symbol || null;
}

function mappedSymbol(asset: MarketDataAssetContext, provider: MarketDataProviderId) {
  const symbols = asset.providerSymbols;
  const value = symbols?.[provider];
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}

/**
 * Resolves a provider symbol without treating provider listings as interchangeable.
 * The small validated alias table is intentionally centralized; VUAA.MI is absent
 * because no exact EODHD listing was validated for it.
 */
export function resolveProviderSymbol(asset: MarketDataAssetContext, provider: MarketDataProviderId): string | null {
  const canonical = canonicalSymbol(asset);
  if (!canonical) return null;

  const explicit = mappedSymbol(asset, provider);
  if (explicit) return explicit;

  if (provider === "FMP") return canonical;

  const validated = VALIDATED_EODHD_SYMBOLS[canonical];
  if (validated) return validated;

  const exchange = asset.exchange?.trim().toUpperCase();
  if (exchange && US_EXCHANGES.has(exchange) && /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(canonical) && !canonical.includes(".")) {
    return `${canonical}.US`;
  }

  return null;
}

export function validatedProviderMappings() {
  return { ...VALIDATED_EODHD_SYMBOLS };
}

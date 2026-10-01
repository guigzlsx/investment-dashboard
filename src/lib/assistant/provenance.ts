import type { DataProvenance } from "../market-data/models";
import type { AssistantProvenance } from "./types";

export function provenanceFromMarket(value: DataProvenance): AssistantProvenance {
  return {
    source: value.source === "ECB" ? "ECB" : "FMP",
    endpoint: value.sourceEndpoint,
    asOfDate: value.asOfDate,
    retrievedAt: value.timestamp,
    freshness: value.freshness,
  };
}

export function calculatedProvenance(label = "Calculated", asOfDate: string | null = null): AssistantProvenance {
  return {
    source: "Calculated",
    label,
    asOfDate,
    retrievedAt: new Date().toISOString(),
    freshness: "CURRENT",
  };
}

export function portfolioProvenance(label = "User portfolio"): AssistantProvenance {
  return {
    source: "Your Portfolio",
    label,
    asOfDate: null,
    retrievedAt: new Date().toISOString(),
    freshness: "CURRENT",
  };
}

export function uniqueProvenance(values: AssistantProvenance[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = `${value.source}:${value.endpoint ?? ""}:${value.asOfDate ?? ""}:${value.label ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resultProvenance(values: AssistantProvenance[]) {
  return uniqueProvenance(values);
}

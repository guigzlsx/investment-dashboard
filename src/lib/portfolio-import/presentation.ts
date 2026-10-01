import type { NormalizedImportedTransaction } from "./types";

export type ImportRowAction = "NONE" | "CHOOSE_ASSET" | "RETRY";

export function importRowAction(row: NormalizedImportedTransaction): ImportRowAction {
  if (row.status === "READY" || row.status === "WARNING" || row.status === "DUPLICATE") return "NONE";
  if (row.assetResolution?.reason === "AMBIGUOUS" && row.assetResolution.candidates.length > 0) return "CHOOSE_ASSET";
  if (row.assetResolution?.reason === "PROVIDER_ERROR") return "RETRY";
  return "NONE";
}

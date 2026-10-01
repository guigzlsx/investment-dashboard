import type { Currency, TransactionType } from "../portfolio/types";
import type { MarketDataErrorCode } from "../market-data/errors";

export type ImportFileFormat = "CSV" | "XLSX";
export type ImportSessionState = "UPLOADED" | "MAPPED" | "VALIDATED" | "READY" | "IMPORTED" | "FAILED";
export type ImportConfidence = "HIGH" | "MEDIUM" | "LOW";
export type ImportRowStatus = "READY" | "WARNING" | "ERROR" | "DUPLICATE" | "UNSUPPORTED" | "IGNORED";

export type ImportColumnField =
  | "ignore"
  | "ticker"
  | "isin"
  | "name"
  | "exchange"
  | "transactionType"
  | "quantity"
  | "price"
  | "currency"
  | "fxRateToBase"
  | "fees"
  | "date";

export interface ImportColumnMapping {
  [column: string]: ImportColumnField;
}

export interface ParsedImportSheet {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface AssetResolutionCandidate {
  id?: string;
  symbol: string;
  name: string;
  isin?: string | null;
  exchange?: string | null;
  currency?: Currency | null;
  assetType?: "STOCK" | "ETF" | null;
}

export interface AssetResolution {
  input: string;
  symbol: string | null;
  name: string | null;
  isin: string | null;
  exchange: string | null;
  assetId: string | null;
  confidence: ImportConfidence;
  candidates: AssetResolutionCandidate[];
  requiresReview: boolean;
  reason: "ISIN_MATCH" | "TICKER_MATCH" | "EXISTING_ASSET" | "PROVIDER_SEARCH" | "AMBIGUOUS" | "NOT_FOUND" | "PROVIDER_ERROR" | "UNSUPPORTED_ASSET" | "INVALID_SYMBOL";
  providerErrorCode?: MarketDataErrorCode | null;
  trace?: {
    existingIsin: "SKIPPED" | "NOT_FOUND" | "MATCH";
    existingTicker: "SKIPPED" | "NOT_FOUND" | "MATCH" | "AMBIGUOUS";
    providerQuery: string | null;
    providerResults: number;
    tickerResults: number;
    contextResults: number;
  };
}

export interface NormalizedImportedTransaction {
  sourceRow: number;
  assetIdentifier: string;
  symbol: string | null;
  name: string | null;
  isin: string | null;
  exchange: string | null;
  assetId: string | null;
  assetType: "STOCK" | "ETF" | null;
  transactionType: TransactionType | null;
  quantity: number | null;
  price: number | null;
  currency: Currency | null;
  fees: number;
  transactionDate: string | null;
  fxRateToBase: number | null;
  confidence: ImportConfidence;
  warnings: string[];
  errors: string[];
  status: ImportRowStatus;
  possibleDuplicate: boolean;
  assetResolution: AssetResolution | null;
}

export interface ImportPreviewSummary {
  total: number;
  ready: number;
  warnings: number;
  errors: number;
  duplicates: number;
  unsupported: number;
  cashIgnored: number;
}

export interface PortfolioImportPreview {
  importId: string;
  fileName: string;
  format: ImportFileFormat;
  state: ImportSessionState;
  sheetNames: string[];
  selectedSheet: string | null;
  columns: string[];
  mapping: ImportColumnMapping;
  detectedPreset: string | null;
  rows: NormalizedImportedTransaction[];
  summary: ImportPreviewSummary;
}

export interface ImportCommitSummary {
  importId: string;
  state: "IMPORTED";
  transactionsImported: number;
  assetsAdded: number;
  duplicatesSkipped: number;
  rowsIgnored: number;
  warnings: number;
}

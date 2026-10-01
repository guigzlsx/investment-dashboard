import type { PortfolioTransaction } from "../portfolio/types";
import type { ImportPreviewSummary, NormalizedImportedTransaction } from "./types";

function sameNumber(left: number | null, right: number | null) {
  return left !== null && right !== null && Math.abs(left - right) < 0.00000001;
}

function duplicateOf(row: NormalizedImportedTransaction, transaction: PortfolioTransaction) {
  return Boolean(row.assetId && transaction.assetId === row.assetId && row.transactionType === transaction.type && sameNumber(row.quantity, transaction.quantity) && sameNumber(row.price, transaction.unitPrice) && row.currency === transaction.currency && row.transactionDate?.slice(0, 10) === transaction.executedAt.slice(0, 10));
}

export function markImportDuplicates(rows: NormalizedImportedTransaction[], existing: PortfolioTransaction[]) {
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.errors.length || row.status === "UNSUPPORTED" || !row.assetId || !row.transactionDate) continue;
    const key = [row.assetId, row.transactionType, row.quantity, row.price, row.currency, row.transactionDate.slice(0, 10)].join("|");
    const possibleDuplicate = existing.some((transaction) => duplicateOf(row, transaction)) || seen.has(key);
    row.possibleDuplicate = possibleDuplicate;
    if (possibleDuplicate) {
      row.status = "DUPLICATE";
      row.warnings = [...row.warnings, "This transaction may already exist in the portfolio"];
    }
    seen.add(key);
  }
  return rows;
}

export function summarizeImportRows(rows: NormalizedImportedTransaction[]): ImportPreviewSummary {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.status === "READY" || row.status === "WARNING" || row.status === "DUPLICATE").length,
    warnings: rows.filter((row) => row.status === "WARNING" || row.status === "DUPLICATE" || row.warnings.length > 0).length,
    errors: rows.filter((row) => row.status === "ERROR").length,
    duplicates: rows.filter((row) => row.status === "DUPLICATE").length,
    unsupported: rows.filter((row) => row.status === "UNSUPPORTED").length,
    cashIgnored: rows.filter((row) => row.status === "IGNORED").length,
  };
}

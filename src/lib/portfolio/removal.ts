import type { PortfolioTransaction } from "./types";

/**
 * Returns the ledger rows removed by a portfolio correction. The caller must
 * already have scoped the transaction list to the authenticated portfolio.
 */
export function transactionsForPosition(transactions: PortfolioTransaction[], portfolioId: string, assetId: string) {
  return transactions.filter((transaction) => transaction.portfolioId === portfolioId && transaction.assetId === assetId);
}

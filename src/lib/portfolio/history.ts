import type { PortfolioSnapshot, PortfolioTransaction } from "./types";

export interface PerformancePoint {
  capturedAt: string;
  portfolioValue: number | null;
  investedCapital: number | null;
  unrealizedPnl: number | null;
  performancePercent: number | null;
  periodReturnPercent: number | null;
  netCashFlow: number;
  currency: string;
  dataQuality: PortfolioSnapshot["dataQuality"];
}

function cashFlow(transaction: PortfolioTransaction) {
  if (transaction.type !== "DEPOSIT" && transaction.type !== "WITHDRAWAL") return 0;
  const amount = transaction.unitPrice ?? (transaction.quantity ?? 0);
  return transaction.type === "DEPOSIT" ? amount : -amount;
}

function flowsBetween(transactions: PortfolioTransaction[], from: string, to: string) {
  return transactions.reduce((total, transaction) => transaction.executedAt > from && transaction.executedAt <= to ? total + cashFlow(transaction) : total, 0);
}

/**
 * Calculates cash-flow-adjusted performance from stored aggregate snapshots.
 * Deposits and withdrawals are excluded from return percentages.
 */
export function calculatePerformanceHistory(snapshots: PortfolioSnapshot[], transactions: PortfolioTransaction[] = []): PerformancePoint[] {
  const ordered = [...snapshots].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
  if (!ordered.length) return [];
  const first = ordered[0];
  let cumulativeFlow = 0;
  return ordered.map((snapshot, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    const netCashFlow = previous ? flowsBetween(transactions, previous.capturedAt, snapshot.capturedAt) : 0;
    cumulativeFlow += netCashFlow;
    const periodReturnPercent = previous?.portfolioValue !== null && previous?.portfolioValue !== undefined && snapshot.portfolioValue !== null && previous.portfolioValue !== 0
      ? (snapshot.portfolioValue - previous.portfolioValue - netCashFlow) / previous.portfolioValue
      : null;
    const performancePercent = first.portfolioValue !== null && first.portfolioValue !== 0 && snapshot.portfolioValue !== null
      ? (snapshot.portfolioValue - first.portfolioValue - cumulativeFlow) / first.portfolioValue
      : null;
    return { capturedAt: snapshot.capturedAt, portfolioValue: snapshot.portfolioValue, investedCapital: snapshot.investedCapital, unrealizedPnl: snapshot.unrealizedPnl, performancePercent, periodReturnPercent, netCashFlow, currency: snapshot.currency, dataQuality: snapshot.dataQuality };
  });
}

export function filterSnapshotsByPeriod(snapshots: PortfolioSnapshot[], period: "1D" | "1W" | "1M" | "YTD" | "1Y" | "ALL", now = new Date()) {
  if (period === "ALL") return snapshots;
  const start = new Date(now);
  if (period === "1D") start.setDate(start.getDate() - 1);
  if (period === "1W") start.setDate(start.getDate() - 7);
  if (period === "1M") start.setMonth(start.getMonth() - 1);
  if (period === "1Y") start.setFullYear(start.getFullYear() - 1);
  if (period === "YTD") start.setMonth(0, 1);
  return snapshots.filter((snapshot) => new Date(snapshot.capturedAt) >= start);
}

import type { FinancialStatement, KeyMetrics } from "../market-data/models";

export type TrendStatus = "ACCELERATING" | "STABLE" | "DECELERATING" | "UNKNOWN";

export interface GrowthPoint {
  period: string;
  periodEnd: string | null;
  revenue: number | null;
  revenueGrowth: number | null;
  eps: number | null;
  epsGrowth: number | null;
  freeCashFlow: number | null;
  freeCashFlowGrowth: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
}

export interface GrowthAnalysis {
  points: GrowthPoint[];
  revenueTrend: TrendStatus;
  epsTrend: TrendStatus;
  freeCashFlowTrend: TrendStatus;
  methodology: string;
}

export interface ValuationMetricHistory {
  metric: "pe" | "forwardPe" | "priceToSales" | "evToEbitda" | "peg";
  current: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  relativeToMedian: number | null;
  points: Array<{ period: string | null; periodEnd: string | null; value: number }>;
}

export interface ValuationAnalysis {
  metrics: ValuationMetricHistory[];
  methodology: string;
  peerComparison: "UNAVAILABLE";
  sectorComparison: "UNAVAILABLE";
}

export type RiskCategory = "Business" | "Competition" | "Valuation" | "Financial" | "Regulatory" | "Geopolitical" | "Customer concentration" | "Cyclicality";

export interface RiskCoverage {
  category: RiskCategory;
  available: boolean;
  observation: string | null;
  evidence: string[];
}

function growth(current: number | null, previous: number | null) {
  return current !== null && previous !== null && previous !== 0 ? current / previous - 1 : null;
}

function trend(values: Array<number | null>): TrendStatus {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (known.length < 2) return "UNKNOWN";
  const difference = known[known.length - 1] - known[known.length - 2];
  if (difference > 0.02) return "ACCELERATING";
  if (difference < -0.02) return "DECELERATING";
  return "STABLE";
}

export function analyzeGrowth(statements: FinancialStatement[]): GrowthAnalysis {
  const ordered = [...statements].sort((left, right) => (left.periodEnd ?? left.period).localeCompare(right.periodEnd ?? right.period));
  const points = ordered.map((statement, index) => {
    const previous = ordered[index - 1];
    return { period: statement.period, periodEnd: statement.periodEnd, revenue: statement.revenue, revenueGrowth: growth(statement.revenue, previous?.revenue ?? null), eps: statement.eps, epsGrowth: growth(statement.eps, previous?.eps ?? null), freeCashFlow: statement.freeCashFlow, freeCashFlowGrowth: growth(statement.freeCashFlow, previous?.freeCashFlow ?? null), grossMargin: statement.revenue && statement.grossProfit !== null ? statement.grossProfit / statement.revenue : null, operatingMargin: statement.revenue && statement.operatingIncome !== null ? statement.operatingIncome / statement.revenue : null };
  });
  return { points, revenueTrend: trend(points.map((point) => point.revenueGrowth)), epsTrend: trend(points.map((point) => point.epsGrowth)), freeCashFlowTrend: trend(points.map((point) => point.freeCashFlowGrowth)), methodology: "Acceleration means the latest growth rate differs from the previous one by more than 2 percentage points; otherwise stable. Fewer than two known rates is unknown." };
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function analyzeValuation(metrics: KeyMetrics[]): ValuationAnalysis {
  const definitions: Array<ValuationMetricHistory["metric"]> = ["pe", "forwardPe", "priceToSales", "evToEbitda", "peg"];
  return { metrics: definitions.map((metric) => {
    const points = metrics.flatMap((item) => item[metric] === null ? [] : [{ period: item.period, periodEnd: item.periodEnd, value: item[metric] as number }]);
    const values = points.map((point) => point.value);
    const current = points[points.length - 1]?.value ?? null;
    const historicalMedian = median(values);
    return { metric, current, median: historicalMedian, minimum: values.length ? Math.min(...values) : null, maximum: values.length ? Math.max(...values) : null, relativeToMedian: current !== null && historicalMedian !== null && historicalMedian !== 0 ? current / historicalMedian - 1 : null, points };
  }), methodology: "Historical context uses the normalized provider observations available for the asset. It is not a BUY/SELL verdict.", peerComparison: "UNAVAILABLE", sectorComparison: "UNAVAILABLE" };
}

export function analyzeRiskCoverage(statement: FinancialStatement | null, metrics: KeyMetrics | null, valuation: ValuationAnalysis | null): RiskCoverage[] {
  const categories: RiskCategory[] = ["Business", "Competition", "Valuation", "Financial", "Regulatory", "Geopolitical", "Customer concentration", "Cyclicality"];
  return categories.map((category) => {
    if (category === "Valuation") {
      const pe = valuation?.metrics.find((item) => item.metric === "pe");
      if (pe?.current !== null && pe?.current !== undefined && pe.relativeToMedian !== null) return { category, available: true, observation: "Current P/E is contextualized against the available historical observations.", evidence: [`Current: ${pe.current}`, `Historical median: ${pe.median ?? "unknown"}`, `Relative difference: ${pe.relativeToMedian}`] };
    }
    if (category === "Financial" && statement && statement.totalDebt !== null && statement.cash !== null) return { category, available: true, observation: "Debt and cash are shown as reported balance-sheet values; their relationship requires investor context.", evidence: [`Debt: ${statement.totalDebt}`, `Cash: ${statement.cash}`, `Debt / cash: ${statement.cash !== 0 ? statement.totalDebt / statement.cash : "unknown"}`] };
    if (category === "Cyclicality" && metrics?.revenueGrowth !== null && metrics?.revenueGrowth !== undefined) return { category, available: true, observation: "Revenue growth is available, but a complete cycle classification is not inferred from one metric.", evidence: [`Latest revenue growth: ${metrics.revenueGrowth}`] };
    return { category, available: false, observation: null, evidence: [] };
  });
}

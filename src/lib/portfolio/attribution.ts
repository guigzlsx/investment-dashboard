export interface AttributionChange {
  symbol: string;
  name?: string;
  change: number | null;
  currency: string;
  dataQuality: "COMPLETE" | "UNKNOWN";
}

export interface PortfolioAttribution {
  period: "1D" | "1W" | "1M";
  totalChange: number | null;
  rows: AttributionChange[];
  dataQuality: "COMPLETE" | "PARTIAL" | "UNKNOWN";
}

export function calculateAttribution(period: PortfolioAttribution["period"], changes: AttributionChange[]): PortfolioAttribution {
  const known = changes.filter((row) => row.change !== null && Number.isFinite(row.change));
  const ordered = [...known].sort((left, right) => Math.abs(right.change ?? 0) - Math.abs(left.change ?? 0));
  return { period, totalChange: known.length ? known.reduce((total, row) => total + (row.change ?? 0), 0) : null, rows: ordered, dataQuality: known.length === changes.length ? "COMPLETE" : known.length ? "PARTIAL" : "UNKNOWN" };
}

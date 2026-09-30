import type { PositionSummary, PortfolioSummary } from "./types";

export type ExposureDimension = "company" | "sector" | "country" | "currency" | "assetType" | "theme";

export interface ExposureRow {
  key: string;
  value: number;
  percent: number;
  symbols: string[];
}

export interface PortfolioHealthReport {
  concentration: ExposureRow[];
  sectors: ExposureRow[];
  countries: ExposureRow[];
  currencies: ExposureRow[];
  assetTypes: ExposureRow[];
  themes: ExposureRow[];
  dataQuality: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  notes: string[];
}

function valueOf(position: PositionSummary, total: number | null) {
  if (position.currentValue !== null && position.currentValue !== undefined) return position.currentValue;
  if (total !== null && position.weight !== null && position.weight !== undefined) return total * position.weight;
  return null;
}

function keysFor(position: PositionSummary, dimension: ExposureDimension) {
  if (dimension === "company") return [position.symbol];
  if (dimension === "sector") return [position.sector ?? "Unknown sector"];
  if (dimension === "country") return [position.country ?? "Unknown geography"];
  if (dimension === "currency") return [position.quoteCurrency ?? "Unknown currency"];
  if (dimension === "assetType") return [position.assetType ?? "Unknown asset type"];
  return position.themes?.length ? position.themes : ["Unclassified themes"];
}

export function calculateExposure(summary: PortfolioSummary, dimension: ExposureDimension): ExposureRow[] {
  const total = summary.currentValue ?? summary.investedCost;
  if (!total || total <= 0) return [];
  const grouped = new Map<string, { value: number; symbols: Set<string> }>();
  for (const position of summary.positions) {
    const value = valueOf(position, summary.currentValue ?? summary.investedCost);
    if (value === null) continue;
    for (const key of keysFor(position, dimension)) {
      const existing = grouped.get(key) ?? { value: 0, symbols: new Set<string>() };
      existing.value += value;
      existing.symbols.add(position.symbol);
      grouped.set(key, existing);
    }
  }
  return [...grouped.entries()].map(([key, group]) => ({ key, value: group.value, percent: group.value / total, symbols: [...group.symbols] })).sort((left, right) => right.percent - left.percent);
}

export function buildPortfolioHealth(summary: PortfolioSummary): PortfolioHealthReport {
  const report = { concentration: calculateExposure(summary, "company"), sectors: calculateExposure(summary, "sector"), countries: calculateExposure(summary, "country"), currencies: calculateExposure(summary, "currency"), assetTypes: calculateExposure(summary, "assetType"), themes: calculateExposure(summary, "theme"), dataQuality: summary.dataQuality, notes: [] as string[] };
  if (report.themes.length === 1 && report.themes[0].key === "Unclassified themes") report.notes.push("Theme exposure is unavailable until assets receive explicit theme classifications.");
  if (report.countries.some((row) => row.key === "Unknown geography")) report.notes.push("Some geographic exposure is unknown because the provider did not classify every asset.");
  if (report.currencies.some((row) => row.key === "Unknown currency")) report.notes.push("Some currency exposure is unknown because the quote currency is missing.");
  const overlappingThemes = report.themes.filter((row) => row.symbols.length > 1 && row.key !== "Unclassified themes");
  if (overlappingThemes.length) report.notes.push(`Shared thematic dependencies are visible in: ${overlappingThemes.map((row) => row.key).join(", ")}. This is an overlap indicator, not a correlation coefficient.`);
  else report.notes.push("Correlation coefficients are not estimated yet; thematic overlap requires explicit asset classifications.");
  return report;
}

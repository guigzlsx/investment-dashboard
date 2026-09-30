import type { Currency, PortfolioSummary, PositionSummary } from "./types";

export interface ScenarioShock {
  key: string;
  label: string;
  shock: number;
}

export interface ScenarioRow {
  key: string;
  label: string;
  baselineValue: number | null;
  shock: number;
  impact: number | null;
}

export interface ScenarioResult {
  baselineValue: number | null;
  estimatedValue: number | null;
  impact: number | null;
  impactPercent: number | null;
  rows: ScenarioRow[];
  dataQuality: "COMPLETE" | "PARTIAL" | "UNKNOWN";
  assumptions: string[];
}

function positionValue(position: PositionSummary, portfolioValue: number | null) {
  if (position.currentValue !== null && position.currentValue !== undefined) return position.currentValue;
  if (portfolioValue !== null && position.weight !== null && position.weight !== undefined) return portfolioValue * position.weight;
  return null;
}

export function calculateScenario(summary: PortfolioSummary, shocks: ScenarioShock[]): ScenarioResult {
  const rows = shocks.map((shock) => {
    const position = summary.positions.find((item) => item.assetId === shock.key || item.symbol === shock.key);
    const baselineValue = position ? positionValue(position, summary.currentValue) : null;
    return { key: shock.key, label: shock.label, baselineValue, shock: shock.shock, impact: baselineValue === null ? null : baselineValue * shock.shock };
  });
  const known = rows.filter((row) => row.impact !== null);
  const impact = known.length === rows.length && rows.length ? known.reduce((total, row) => total + (row.impact ?? 0), 0) : null;
  const baselineValue = summary.currentValue;
  return { baselineValue, estimatedValue: baselineValue !== null && impact !== null ? baselineValue + impact : null, impact, impactPercent: baselineValue !== null && baselineValue !== 0 && impact !== null ? impact / baselineValue : null, rows, dataQuality: !rows.length || !baselineValue ? "UNKNOWN" : known.length === rows.length ? "COMPLETE" : known.length ? "PARTIAL" : "UNKNOWN", assumptions: ["Chocs mécaniques indépendants, sans corrélation ni réaction en chaîne.", "Les positions sans valeur actuelle connue ne sont pas estimées."] };
}

export function calculateFxScenario(summary: PortfolioSummary, currency: Currency, shock: number): ScenarioResult {
  const rows = summary.positions.filter((position) => position.quoteCurrency === currency).map((position) => {
    const baselineValue = positionValue(position, summary.currentValue);
    return { key: position.assetId ?? position.symbol, label: position.symbol, baselineValue, shock, impact: baselineValue === null ? null : baselineValue * shock };
  });
  const known = rows.filter((row) => row.impact !== null);
  const impact = known.length === rows.length && rows.length ? known.reduce((total, row) => total + (row.impact ?? 0), 0) : null;
  return { baselineValue: summary.currentValue, estimatedValue: summary.currentValue !== null && impact !== null ? summary.currentValue + impact : null, impact, impactPercent: summary.currentValue !== null && summary.currentValue !== 0 && impact !== null ? impact / summary.currentValue : null, rows, dataQuality: !rows.length ? "UNKNOWN" : known.length === rows.length ? "COMPLETE" : known.length ? "PARTIAL" : "UNKNOWN", assumptions: [`Seule l'exposition ${currency} est affectée.`, "Le cours des actifs reste inchangé dans leur devise de cotation."] };
}

import type { PortfolioSummary, PositionSummary } from "../portfolio/types";

export type InsightSeverity = "INFO" | "MEDIUM" | "HIGH";

export interface PortfolioInsight {
  type: "CONCENTRATION" | "SECTOR_CONCENTRATION" | "ETF_EXPOSURE";
  severity: InsightSeverity;
  title: string;
  description: string;
  evidence: Array<{ label: string; value: string }>;
}

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function allocation(position: PositionSummary, totalInvested: number) {
  return position.weight ?? (totalInvested > 0 ? position.costBasis / totalInvested : null);
}

export class PortfolioInsightEngine {
  generate(summary: PortfolioSummary): PortfolioInsight[] {
    const insights: PortfolioInsight[] = [];
    const totalInvested = summary.investedCost ?? 0;

    for (const position of summary.positions) {
      const weight = allocation(position, totalInvested);
      if (weight !== null && weight > 0.4) {
        insights.push({
          type: "CONCENTRATION",
          severity: weight > 0.5 ? "HIGH" : "MEDIUM",
          title: `${position.symbol} is a major portfolio exposure`,
          description: `${position.symbol} represents ${percentage(weight)} of the portfolio allocation. A large move in this position can materially change the total result.`,
          evidence: [{ label: "Portfolio weight", value: percentage(weight) }, { label: "Method", value: position.weight === null ? "Invested cost" : "Current value" }],
        });
      }
    }

    const sectors = new Map<string, number>();
    for (const position of summary.positions) {
      const weight = allocation(position, totalInvested);
      if (position.sector && weight !== null) sectors.set(position.sector, (sectors.get(position.sector) ?? 0) + weight);
    }
    for (const [sector, weight] of sectors) {
      if (weight > 0.6) {
        insights.push({ type: "SECTOR_CONCENTRATION", severity: weight > 0.75 ? "HIGH" : "MEDIUM", title: `${sector} exposure deserves attention`, description: `Your positions classified in ${sector} represent ${percentage(weight)} of the portfolio. Several companies may react to the same economic cycle.`, evidence: [{ label: "Sector", value: sector }, { label: "Allocation", value: percentage(weight) }] });
      }
    }

    if (summary.positions.length > 0) {
      const etfWeight = summary.positions.reduce((total, position) => {
        const weight = allocation(position, totalInvested);
        return total + (position.assetType === "ETF" && weight !== null ? weight : 0);
      }, 0);
      if (etfWeight < 0.1) {
        insights.push({ type: "ETF_EXPOSURE", severity: "INFO", title: "Diversified ETF exposure is currently limited", description: `ETFs represent ${percentage(etfWeight)} of the current allocation. This is a factual description, not a recommendation to change it.`, evidence: [{ label: "ETF allocation", value: percentage(etfWeight) }, { label: "Threshold", value: "10%" }] });
      }
    }

    return insights;
  }
}

export const portfolioInsightEngine = new PortfolioInsightEngine();

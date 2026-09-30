"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioInsight } from "../../lib/insights/engine";
import type { PortfolioSummary } from "../../lib/portfolio/types";
import { formatMoney, formatNumber, formatPercent } from "../../lib/ui/format";
import { Icon } from "../layout/icon";
import { PortfolioIntelligence } from "./portfolio-intelligence";

const emptySummary: PortfolioSummary = { baseCurrency: "EUR", investedCost: null, currentValue: null, pnl: null, performance: null, dailyChange: null, dataQuality: "UNKNOWN", positions: [] };

export function DashboardLive() {
  const [summary, setSummary] = useState(emptySummary);
  const [insights, setInsights] = useState<PortfolioInsight[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([fetch("/api/portfolio/summary"), fetch("/api/portfolio/insights")]).then(async ([summaryResponse, insightsResponse]) => {
        const summaryBody = await summaryResponse.json() as { data?: PortfolioSummary; errors?: Array<{ symbol: string; message: string }>; error?: { message?: string } };
        const insightsBody = await insightsResponse.json() as { data?: PortfolioInsight[] };
        if (!summaryResponse.ok) throw new Error(summaryBody.error?.message ?? "Portfolio unavailable");
        setSummary(summaryBody.data ?? emptySummary);
        setInsights(insightsBody.data ?? []);
        setMessage(summaryBody.errors?.length ? "Some quotes or FX rates are unavailable; affected values remain unknown." : "");
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Portfolio unavailable")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <section className="panel loading-panel">Loading portfolio overview…</section>;

  return <>
    <section className="hero-card"><div className="hero-label">Portfolio value</div><div className="hero-value">{formatMoney(summary.currentValue, summary.baseCurrency)} <span className="currency">{summary.baseCurrency}</span></div><div className="hero-meta"><div className="mini-stat"><span className="mini-stat-label">Invested</span><span className="mini-stat-value">{formatMoney(summary.investedCost, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Unrealized P/L</span><span className="mini-stat-value">{formatMoney(summary.pnl, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Performance</span><span className="mini-stat-value">{formatPercent(summary.performance)}</span></div><div className="mini-stat"><span className="mini-stat-label">Daily change</span><span className="mini-stat-value">{formatMoney(summary.dailyChange, summary.baseCurrency)}</span></div></div><div className="hero-note"><span className="status-dot" /><span>{message || <>Data quality: <strong>{summary.dataQuality}</strong>.</>}</span></div></section>
    <PortfolioIntelligence />
    <div className="dashboard-grid"><section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio evolution</div><div className="panel-caption">Snapshots will appear after the first recorded valuation</div></div><Link className="panel-link" href="/portfolio">View portfolio</Link></div><div className="chart-placeholder"><div className="empty-center"><span className="empty-title">No portfolio history yet</span><p className="empty-copy">The current value is live when quotes are available. Historical periods require saved snapshots.</p></div></div></section><section className="panel"><div className="panel-header"><div><div className="panel-title">Allocation</div><div className="panel-caption">Current value when quotes are complete</div></div></div>{summary.positions.length ? <div className="allocation-list">{summary.positions.slice(0, 6).map((position) => <div className="allocation-row" key={position.assetId ?? position.symbol}><span><strong>{position.symbol}</strong><small>{position.name ?? "—"}</small></span><span>{formatPercent(position.weight)}</span></div>)}</div> : <div className="empty-center"><div className="empty-title">No positions yet</div><p className="empty-copy">Add a BUY transaction to start the portfolio.</p></div>}</section></div>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Positions</div><div className="panel-caption">Derived from your transaction ledger</div></div><Link className="panel-link" href="/portfolio">Open portfolio</Link></div>{summary.positions.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Quantity</th><th>Average Price</th><th>Current Price</th><th>Value</th><th>P/L</th><th>Weight</th></tr></thead><tbody>{summary.positions.map((position) => <tr key={position.assetId ?? position.symbol}><td><Link className="table-primary" href={`/assets/${encodeURIComponent(position.symbol)}`}>{position.symbol}</Link><span className="table-secondary">{position.name ?? "—"}</span></td><td>{formatNumber(position.quantity, 6)}</td><td>{formatMoney(position.averagePrice, position.averagePriceCurrency ?? position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentPrice, position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentValue, summary.baseCurrency)}</td><td className={position.unrealizedPnl !== null && position.unrealizedPnl !== undefined && position.unrealizedPnl < 0 ? "negative" : "positive"}>{formatMoney(position.unrealizedPnl, summary.baseCurrency)}</td><td>{formatPercent(position.weight)}</td></tr>)}</tbody></table></div> : <div className="empty-center"><div className="empty-title">No positions yet</div><p className="empty-copy">Add a BUY transaction to calculate quantity, cost basis and P/L.</p><Link className="panel-link" href="/portfolio">Add a transaction <Icon name="arrow" size={13} /></Link></div>}</section>
    <div className="dashboard-grid equal"><section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio insights</div><div className="panel-caption">Deterministic facts from your current ledger</div></div><Link className="panel-link" href="/analysis">Open analysis</Link></div>{insights.length ? <div className="insight-list">{insights.map((insight) => <div className="insight-row" key={`${insight.type}-${insight.title}`}><span className="insight-marker" /><div className="insight-text"><strong>{insight.title}</strong><br />{insight.description}<div className="insight-evidence">{insight.evidence.map((item) => <span key={item.label}>{item.label}: {item.value}</span>)}</div></div></div>)}</div> : <div className="empty-center"><div className="empty-title">No insight to show yet</div><p className="empty-copy">Insights appear once positions are available.</p></div>}</section><section className="panel"><div className="panel-header"><div><div className="panel-title">What to do next</div><div className="panel-caption">Keep the data foundation auditable</div></div></div><div className="insight-list"><div className="insight-row"><span className="insight-marker" /><div className="insight-text">Add transactions so the position ledger can be rebuilt after every refresh.</div></div><div className="insight-row"><span className="insight-marker" /><div className="insight-text">Open an asset fiche to inspect provider timestamps and missing fields.</div></div><div className="insight-row"><span className="insight-marker" /><div className="insight-text">Treat delayed or unknown data as uncertainty, never as zero.</div></div></div></section></div>
  </>;
}

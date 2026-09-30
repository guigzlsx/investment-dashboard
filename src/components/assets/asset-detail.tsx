"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Asset, CompanyProfile, FinancialStatement, KeyMetrics, Quote } from "../../lib/market-data/models";
import type { GrowthAnalysis, RiskCoverage, ValuationAnalysis } from "../../lib/analysis/fundamentals";
import { dataStatus, formatDate, formatMoney, formatNumber, formatPercent } from "../../lib/ui/format";
import { InvestmentJournal } from "./investment-journal";

type AssetResponse = {
  data: {
    symbol: string;
    profile: CompanyProfile | null;
    quote: Quote | null;
    metrics: KeyMetrics[];
    historicalPrices: Array<{ date: string; close: number | null }>;
    financials: FinancialStatement[];
    growth: GrowthAnalysis | null;
    valuation: ValuationAnalysis | null;
    risks: RiskCoverage[];
  };
  errors?: Array<{ message: string }>;
};

function Metric({ label, value, help }: { label: string; value: string; help: string }) {
  return <div className="metric-card" title={help}><span className="metric-label">{label} <span className="metric-help">?</span></span><strong>{value}</strong><span className="metric-description">{help}</span></div>;
}

function formatMultiple(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${formatNumber(value)}x`;
}

export function AssetDetail({ symbol }: { symbol: string }) {
  const [payload, setPayload] = useState<AssetResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [watchlisted, setWatchlisted] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [assetResponse, watchlistResponse] = await Promise.all([
          fetch(`/api/market/assets/${encodeURIComponent(symbol)}`),
          fetch("/api/watchlist"),
        ]);
        const assetBody = await assetResponse.json() as AssetResponse & { error?: { message?: string } };
        if (!assetResponse.ok) throw new Error(assetBody.error?.message ?? "Market data unavailable");
        if (!cancelled) {
          setPayload(assetBody.data);
          if (watchlistResponse.ok) {
            const watchlistBody = await watchlistResponse.json() as { data?: Array<{ asset?: { symbol?: string } }> };
            setWatchlisted(Boolean(watchlistBody.data?.some((item) => item.asset?.symbol?.toUpperCase() === symbol.toUpperCase())));
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Market data unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [symbol]);

  async function toggleWatchlist() {
    if (!payload || watchlisted) return;
    setWatchlistMessage("");
    const profile = payload.profile;
    const asset: Partial<Asset> = {
      symbol: payload.symbol,
      name: profile?.name ?? payload.symbol,
      exchange: null,
      exchangeName: null,
      currency: payload.quote?.currency ?? null,
      assetType: "STOCK",
    };
    try {
      const response = await fetch("/api/watchlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to update watchlist");
      setWatchlisted(true);
    } catch (toggleError) {
      setWatchlistMessage(toggleError instanceof Error ? toggleError.message : "Unable to update watchlist");
    }
  }

  if (loading) return <section className="panel loading-panel">Loading provider data…</section>;
  if (error || !payload) return <section className="panel"><div className="empty-center"><div className="empty-title">Data unavailable</div><p className="empty-copy">{error || "No provider response was available for this symbol."}</p><Link className="button" href="/settings">Review data configuration</Link></div></section>;

  const { profile, quote, metrics } = payload;
  const keyMetrics = metrics[0] ?? null;
  return <div className="asset-detail-stack">
    <section className="panel asset-header-panel">
      <div className="asset-heading"><div className="asset-logo">{(profile?.name ?? payload.symbol).slice(0, 1).toUpperCase()}</div><div><div className="eyebrow">{profile?.sector ?? "Market asset"}</div><h2 className="asset-name">{profile?.name ?? payload.symbol}</h2><div className="asset-symbol">{payload.symbol} · {quote?.currency ?? "—"}</div></div></div>
      <div className="asset-header-actions"><div className="asset-price">{formatMoney(quote?.price, quote?.currency ?? "EUR")}<span className={quote?.change1DPercent !== null && quote?.change1DPercent !== undefined && quote.change1DPercent < 0 ? "negative" : "positive"}>{formatPercent(quote?.change1DPercent)}</span></div><button className="button button-primary" onClick={toggleWatchlist} disabled={watchlisted}>{watchlisted ? "★ Watchlisted" : "☆ Add to Watchlist"}</button></div>
    </section>
    {watchlistMessage ? <div className="inline-error">{watchlistMessage}</div> : null}
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Market data</div><div className="panel-caption">Provider-backed values only · {dataStatus(quote?.provenance.dataKind)}</div></div><span className="date-note">Updated {formatDate(quote?.provenance.timestamp)}</span></div><div className="metric-grid"><Metric label="Market Cap" value={formatMoney(quote?.marketCap, quote?.currency ?? "EUR")} help="The market value of all outstanding shares." /><Metric label="P/E" value={formatNumber(keyMetrics?.pe)} help="Price divided by earnings per share; compare with the company, sector and growth context." /><Metric label="Forward P/E" value={formatNumber(keyMetrics?.forwardPe)} help="Price divided by expected future earnings; estimates can change." /><Metric label="Revenue Growth" value={formatPercent(keyMetrics?.revenueGrowth)} help="The latest normalized revenue growth rate returned by the provider." /><Metric label="Gross Margin" value={formatPercent(keyMetrics?.grossMargin)} help="Revenue remaining after the direct costs of delivering the product or service." /><Metric label="Operating Margin" value={formatPercent(keyMetrics?.operatingMargin)} help="Operating profit as a share of revenue." /></div></section>
    <section className="dashboard-grid equal"><section className="panel"><div className="panel-header"><div><div className="panel-title">What they do</div><div className="panel-caption">A concise company profile</div></div></div><p className="body-copy">{profile?.description ?? "No company description is available from the configured provider."}</p>{profile?.website ? <a className="panel-link" href={profile.website} rel="noreferrer" target="_blank">Company website ↗</a> : null}</section><section className="panel"><div className="panel-header"><div><div className="panel-title">Price history</div><div className="panel-caption">{payload.historicalPrices.length ? `${payload.historicalPrices.length} observations returned` : "No historical observations returned"}</div></div></div><div className="history-summary"><span>Latest close</span><strong>{formatMoney(payload.historicalPrices[0]?.close, quote?.currency ?? "EUR")}</strong><span>52-week range</span><strong>{formatMoney(quote?.yearLow, quote?.currency ?? "EUR")} — {formatMoney(quote?.yearHigh, quote?.currency ?? "EUR")}</strong></div></section></section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Financial quality</div><div className="panel-caption">Latest normalized provider statement</div></div></div><div className="metric-grid"><Metric label="Revenue" value={formatMoney(payload.financials[0]?.revenue, payload.financials[0]?.reportedCurrency ?? quote?.currency ?? "EUR")} help="Reported revenue for the latest available period." /><Metric label="Net Income" value={formatMoney(payload.financials[0]?.netIncome, payload.financials[0]?.reportedCurrency ?? quote?.currency ?? "EUR")} help="Reported net income for the latest available period." /><Metric label="EPS" value={formatNumber(payload.financials[0]?.eps)} help="Earnings per share reported by the provider." /><Metric label="Free Cash Flow" value={formatMoney(payload.financials[0]?.freeCashFlow, payload.financials[0]?.reportedCurrency ?? quote?.currency ?? "EUR")} help="Cash remaining after operating and capital expenditure data available from the provider." /><Metric label="Debt" value={formatMoney(payload.financials[0]?.totalDebt, payload.financials[0]?.reportedCurrency ?? quote?.currency ?? "EUR")} help="Total debt reported by the provider." /><Metric label="Cash" value={formatMoney(payload.financials[0]?.cash, payload.financials[0]?.reportedCurrency ?? quote?.currency ?? "EUR")} help="Cash and cash equivalents reported by the provider." /><Metric label="ROIC" value={formatPercent(keyMetrics?.roic)} help="Return on invested capital, when supplied by the provider." /><Metric label="ROE" value={formatPercent(keyMetrics?.roe)} help="Return on equity, when supplied by the provider." /></div></section>
    <section className="dashboard-grid equal"><section className="panel"><div className="panel-header"><div><div className="panel-title">Growth</div><div className="panel-caption">{payload.growth?.methodology ?? "No growth series available."}</div></div></div>{payload.growth?.points.length ? <div className="data-table-wrap"><table className="data-table compact-table"><thead><tr><th>Period</th><th>Revenue</th><th>Revenue Growth</th><th>EPS</th><th>FCF Growth</th></tr></thead><tbody>{payload.growth.points.map((point) => <tr key={`${point.period}-${point.periodEnd ?? ""}`}><td>{point.period}</td><td>{formatMoney(point.revenue, quote?.currency ?? "EUR")}</td><td>{formatPercent(point.revenueGrowth)}</td><td>{formatNumber(point.eps)}</td><td>{formatPercent(point.freeCashFlowGrowth)}</td></tr>)}</tbody></table></div> : <div className="empty-copy">No financial periods available.</div>}<div className="trend-row"><span>Revenue: <strong>{payload.growth?.revenueTrend ?? "UNKNOWN"}</strong></span><span>EPS: <strong>{payload.growth?.epsTrend ?? "UNKNOWN"}</strong></span><span>FCF: <strong>{payload.growth?.freeCashFlowTrend ?? "UNKNOWN"}</strong></span></div></section><section className="panel"><div className="panel-header"><div><div className="panel-title">Valuation context</div><div className="panel-caption">Historical provider observations, not a verdict</div></div></div>{payload.valuation?.metrics.some((metric) => metric.points.length) ? <div className="valuation-list">{payload.valuation.metrics.map((metric) => <div className="valuation-row" key={metric.metric}><span><strong>{metric.metric}</strong><small>{metric.points.length ? `${metric.points.length} observations` : "No observations"}</small></span><span><b>{formatMultiple(metric.current)}</b><small>Median {formatMultiple(metric.median)} · {formatPercent(metric.relativeToMedian)} </small></span></div>)}</div> : <div className="empty-copy">No historical valuation series available from the provider.</div>}</section></section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Company risks</div><div className="panel-caption">Only structured observations supported by available data are shown.</div></div></div><div className="risk-list">{payload.risks.map((risk) => <div className="risk-row" key={risk.category}><span><strong>{risk.category}</strong><small>{risk.available ? risk.observation : "No structured provider data available"}</small></span>{risk.evidence.length ? <span className="risk-evidence">{risk.evidence.join(" · ")}</span> : <span className="date-note">—</span>}</div>)}</div></section><InvestmentJournal symbol={payload.symbol} />
  </div>;
}

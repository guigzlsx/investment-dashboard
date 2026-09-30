"use client";

import { useEffect, useState } from "react";
import type { PortfolioAttribution } from "../../lib/portfolio/attribution";
import type { PerformancePoint } from "../../lib/portfolio/history";
import { formatDate, formatMoney, formatPercent } from "../../lib/ui/format";

const periods = ["1D", "1W", "1M", "YTD", "1Y", "ALL"] as const;
const attributionPeriods = ["1D", "1W", "1M"] as const;

function MiniChart({ points, currency }: { points: PerformancePoint[]; currency: string }) {
  const values = points.flatMap((point) => point.portfolioValue === null ? [] : [point.portfolioValue]);
  if (values.length < 2) return <div className="chart-placeholder"><div className="empty-center"><div className="empty-title">Not enough snapshots yet</div><p className="empty-copy">Capture snapshots after meaningful portfolio changes to build this history.</p></div></div>;
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  const coordinates = points.flatMap((point, index) => point.portfolioValue === null ? [] : [`${(index / (points.length - 1)) * 100},${100 - ((point.portfolioValue - min) / range) * 85 - 7}`]);
  return <div className="portfolio-chart"><svg aria-label={`Portfolio value in ${currency}`} role="img" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline fill="none" points={coordinates.join(" ")} stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg><div className="chart-endpoints"><span>{formatMoney(min, currency)}</span><span>{formatMoney(max, currency)}</span></div></div>;
}

export function PortfolioIntelligence() {
  const [period, setPeriod] = useState<(typeof periods)[number]>("1M");
  const [attributionPeriod, setAttributionPeriod] = useState<(typeof attributionPeriods)[number]>("1D");
  const [points, setPoints] = useState<PerformancePoint[]>([]);
  const [attribution, setAttribution] = useState<PortfolioAttribution | null>(null);
  const [currency, setCurrency] = useState("EUR");
  const [message, setMessage] = useState("");
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/portfolio/snapshots?period=${period}`).then(async (response) => {
        const body = await response.json() as { performance?: PerformancePoint[]; data?: Array<{ currency: string }>; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Performance history unavailable");
        setPoints(body.performance ?? []);
        setCurrency(body.data?.[0]?.currency ?? "EUR");
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Performance history unavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [period]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/portfolio/attribution?period=${attributionPeriod}`).then(async (response) => {
        const body = await response.json() as { data?: PortfolioAttribution; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Attribution unavailable");
        setAttribution(body.data ?? null);
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Attribution unavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [attributionPeriod]);

  async function captureSnapshot() {
    setCapturing(true); setMessage("");
    try {
      const response = await fetch("/api/portfolio/snapshots", { method: "POST" });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Snapshot could not be captured");
      setPeriod("ALL");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Snapshot could not be captured"); }
    finally { setCapturing(false); }
  }

  return <div className="dashboard-grid"><section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio evolution</div><div className="panel-caption">Stored snapshots · {points.length} point{points.length === 1 ? "" : "s"}</div></div><div className="panel-actions"><div className="periods" role="group" aria-label="Performance period">{periods.map((item) => <button className={`period-button ${item === period ? "selected" : ""}`} key={item} onClick={() => setPeriod(item)}>{item}</button>)}</div><button className="table-action" disabled={capturing} onClick={() => void captureSnapshot()}>{capturing ? "Capturing…" : "Capture"}</button></div></div>{message ? <div className="inline-error">{message}</div> : null}<MiniChart currency={currency} points={points} />{points.length ? <div className="chart-foot"><span>{formatDate(points[0].capturedAt)}</span><strong>{formatPercent(points[points.length - 1].performancePercent)}</strong><span>{formatDate(points[points.length - 1].capturedAt)}</span></div> : null}</section><section className="panel"><div className="panel-header"><div><div className="panel-title">What moved my portfolio?</div><div className="panel-caption">Estimated contribution in {attribution?.rows[0]?.currency ?? currency}</div></div><div className="periods" role="group" aria-label="Attribution period">{attributionPeriods.map((item) => <button className={`period-button ${item === attributionPeriod ? "selected" : ""}`} key={item} onClick={() => setAttributionPeriod(item)}>{item}</button>)}</div></div>{attribution?.rows.length ? <div className="attribution-list"><div className="attribution-total"><span>Total change</span><strong className={attribution.totalChange !== null && attribution.totalChange < 0 ? "negative" : "positive"}>{formatMoney(attribution.totalChange, attribution.rows[0]?.currency ?? currency)}</strong></div>{attribution.rows.slice(0, 8).map((row) => <div className="attribution-row" key={row.symbol}><span><strong>{row.symbol}</strong><small>{row.name ?? "—"}</small></span><span className={row.change !== null && row.change < 0 ? "negative" : "positive"}>{formatMoney(row.change, row.currency)}</span></div>)}</div> : <div className="empty-center"><div className="empty-title">No attribution yet</div><p className="empty-copy">Quotes and historical prices are required to explain the selected period.</p></div>}</section></div>;
}

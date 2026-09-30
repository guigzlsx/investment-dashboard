"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PortfolioHealthReport } from "../../lib/portfolio/exposures";
import type { PortfolioSummary } from "../../lib/portfolio/types";
import { formatMoney, formatPercent } from "../../lib/ui/format";

function ExposurePanel({ title, description, rows }: { title: string; description: string; rows: PortfolioHealthReport["concentration"] }) {
  return <section className="panel"><div className="panel-header"><div><div className="panel-title">{title}</div><div className="panel-caption">{description}</div></div></div>{rows.length ? <div className="exposure-list">{rows.slice(0, 8).map((row) => <div className="exposure-row" key={row.key}><span><strong>{row.key}</strong><small>{row.symbols.join(" · ")}</small></span><span>{formatPercent(row.percent)}</span></div>)}</div> : <div className="empty-center"><div className="empty-title">No classified data</div><p className="empty-copy">This exposure cannot be calculated from the available provider data.</p></div>}</section>;
}

export function HealthView() {
  const [report, setReport] = useState<PortfolioHealthReport | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/portfolio/health").then(async (response) => {
        const body = await response.json() as { data?: PortfolioHealthReport; summary?: PortfolioSummary; error?: { message?: string } };
        if (!response.ok) throw new Error(body.error?.message ?? "Portfolio health unavailable");
        setReport(body.data ?? null); setSummary(body.summary ?? null);
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Portfolio health unavailable")).finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <section className="panel loading-panel">Loading portfolio health…</section>;
  if (message || !report) return <section className="panel"><div className="empty-center"><div className="empty-title">Portfolio health unavailable</div><p className="empty-copy">{message || "No health report is available."}</p><Link className="button" href="/login">Sign in to inspect your portfolio</Link></div></section>;

  return <div className="health-stack"><section className="hero-card"><div className="hero-label">Portfolio health</div><div className="hero-value">{summary?.currentValue === null || summary?.currentValue === undefined ? "—" : formatMoney(summary.currentValue, summary.baseCurrency)} <span className="currency">{summary?.baseCurrency ?? "EUR"}</span></div><div className="hero-note"><span className="status-dot" /><span>Exposures are descriptive indicators, not a portfolio score or recommendation. Data quality: <strong>{report.dataQuality}</strong>.</span></div></section>{report.notes.length ? <section className="panel"><div className="panel-title">Data notes</div><div className="health-notes">{report.notes.map((note) => <p key={note}>{note}</p>)}</div></section> : null}<div className="health-grid"><ExposurePanel description="Share of current portfolio value" rows={report.concentration} title="Concentration by position" /><ExposurePanel description="Provider sector classification" rows={report.sectors} title="Sector exposure" /><ExposurePanel description="Provider country classification" rows={report.countries} title="Geographic exposure" /><ExposurePanel description="Quote currencies translated into base currency" rows={report.currencies} title="Currency exposure" /><ExposurePanel description="Stocks, ETFs and other known types" rows={report.assetTypes} title="Asset type exposure" /><ExposurePanel description="Overlapping classifications may sum above 100%" rows={report.themes} title="Thematic exposure" /></div></div>;
}

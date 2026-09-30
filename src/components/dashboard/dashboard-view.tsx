"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "../layout/icon";

const periods = ["1D", "1W", "1M", "3M", "1Y", "ALL"];

function EmptyState({ title, copy, action, icon = "database" }: { title: string; copy: string; action?: React.ReactNode; icon?: "database" | "spark" | "portfolio" }) {
  return <div className="empty-center"><span className="empty-icon"><Icon name={icon} size={16} /></span><div className="empty-title">{title}</div><p className="empty-copy">{copy}</p>{action ? <div className="empty-action">{action}</div> : null}</div>;
}

export function DashboardView() {
  const [selectedPeriod, setSelectedPeriod] = useState("1M");

  return <>
    <section className="hero-card">
      <div className="hero-label">Portfolio value</div>
      <div className="hero-value">— <span className="currency">EUR</span></div>
      <div className="hero-meta"><div className="mini-stat"><span className="mini-stat-label">Invested</span><span className="mini-stat-value">—</span></div><div className="mini-stat"><span className="mini-stat-label">P/L</span><span className="mini-stat-value">—</span></div><div className="mini-stat"><span className="mini-stat-label">Performance</span><span className="mini-stat-value">—</span></div></div>
      <div className="hero-note"><span className="status-dot" /><span><strong>Start with your own data.</strong> Connect a market source and add your first transaction to unlock portfolio insights.</span></div>
    </section>

    <div className="dashboard-grid">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio evolution</div><div className="panel-caption">Values will appear after your first snapshot</div></div><div className="periods" role="group" aria-label="Chart period">{periods.map((period) => <button className={`period-button ${period === selectedPeriod ? "selected" : ""}`} key={period} onClick={() => setSelectedPeriod(period)}>{period}</button>)}</div></div><div className="chart-placeholder"><EmptyState title="No portfolio history yet" copy={`The ${selectedPeriod} view will be calculated from your portfolio snapshots.`} icon="portfolio" /></div></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio allocation</div><div className="panel-caption">By company, sector, geography and currency</div></div><Link className="panel-link" href="/portfolio">View details</Link></div><EmptyState title="Allocation is waiting for positions" copy="Once transactions and prices are available, concentration will be explained here in plain language." /></section>
    </div>

    <div className="dashboard-grid equal">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Positions</div><div className="panel-caption">Your holdings, cost basis and daily movement</div></div><Link className="panel-link" href="/portfolio">Open portfolio</Link></div><EmptyState title="No positions yet" copy="Add a BUY transaction to start calculating your weighted average price." action={<Link href="/portfolio">Add a transaction <Icon name="arrow" size={13} /></Link>} icon="portfolio" /></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Portfolio insights</div><div className="panel-caption">Context, not just numbers</div></div><Link className="panel-link" href="/analysis">Ask the assistant</Link></div><div className="insight-list"><div className="insight-row"><span className="insight-marker" /><div className="insight-text"><strong>Concentration</strong> will highlight when one company or theme becomes too important in your portfolio.</div></div><div className="insight-row"><span className="insight-marker" /><div className="insight-text"><strong>Context</strong> will connect sectors, currencies and economic exposures instead of listing isolated ratios.</div></div><div className="insight-row"><span className="insight-marker" /><div className="insight-text"><strong>Uncertainty</strong> will stay visible whenever data is delayed, partial or based on assumptions.</div></div></div></section>
    </div>

    <div className="dashboard-grid equal">
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Watchlist attention</div><div className="panel-caption">Companies that deserve a closer look</div></div><Link className="panel-link" href="/watchlist">Open watchlist</Link></div><EmptyState title="Your watchlist is empty" copy="Search for a stock or ETF to save it and follow the metrics that matter to you." action={<Link href="/watchlist">Explore watchlist <Icon name="arrow" size={13} /></Link>} icon="spark" /></section>
      <section className="panel"><div className="panel-header"><div><div className="panel-title">Important events</div><div className="panel-caption">Earnings, guidance and company news</div></div><span className="date-note">No source connected</span></div><EmptyState title="Events will appear here" copy="Only relevant events will be surfaced, with their source and publication date." icon="database" /></section>
    </div>

    <section className="setup-strip"><div className="setup-copy"><div className="setup-title">Build your personal investment workspace</div><div className="setup-description">Your data should tell a story: what you own, why you own it, and what could change your mind.</div></div><div className="setup-steps"><div className="setup-step"><span className="step-number">1</span> Connect source</div><div className="setup-step"><span className="step-number">2</span> Add transaction</div><div className="setup-step"><span className="step-number">3</span> Write your thesis</div></div></section>
  </>;
}

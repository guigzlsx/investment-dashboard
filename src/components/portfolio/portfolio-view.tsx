"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { PortfolioSummary, PortfolioTransaction } from "../../lib/portfolio/types";
import { formatDate, formatMoney, formatNumber, formatPercent } from "../../lib/ui/format";

const emptySummary: PortfolioSummary = { baseCurrency: "EUR", investedCost: null, currentValue: null, pnl: null, performance: null, dailyChange: null, dataQuality: "UNKNOWN", positions: [] };

export function PortfolioView() {
  const [summary, setSummary] = useState<PortfolioSummary>(emptySummary);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [form, setForm] = useState({ symbol: "", type: "BUY", quantity: "", price: "", currency: "EUR", fees: "0", fxRateToBase: "", executedAt: new Date().toISOString().slice(0, 16) });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([fetch("/api/portfolio/summary"), fetch("/api/portfolio/transactions")]);
      const summaryBody = await summaryResponse.json() as { data?: PortfolioSummary; error?: { message?: string } };
      const transactionsBody = await transactionsResponse.json() as { data?: PortfolioTransaction[]; error?: { message?: string } };
      if (!summaryResponse.ok) throw new Error(summaryBody.error?.message ?? "Portfolio unavailable");
      if (!transactionsResponse.ok) throw new Error(transactionsBody.error?.message ?? "Transactions unavailable");
      setSummary(summaryBody.data ?? emptySummary);
      setTransactions(transactionsBody.data ?? []);
      setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Portfolio unavailable"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/portfolio/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, quantity: Number(form.quantity), price: Number(form.price), fees: Number(form.fees), fxRateToBase: form.currency === "EUR" ? null : Number(form.fxRateToBase), executedAt: new Date(form.executedAt).toISOString() }) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Transaction could not be saved");
      setForm((current) => ({ ...current, symbol: "", quantity: "", price: "", fees: "0", fxRateToBase: "" }));
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Transaction could not be saved"); }
    finally { setSaving(false); }
  }

  if (loading) return <section className="panel loading-panel">Loading portfolio…</section>;
  if (message && !transactions.length) return <section className="panel"><div className="empty-center"><div className="empty-title">Portfolio unavailable</div><p className="empty-copy">{message}</p><Link className="button" href="/login">Sign in to use your private portfolio</Link></div></section>;

  return <div className="portfolio-stack"><section className="panel"><div className="panel-header"><div><div className="panel-title">Add transaction</div><div className="panel-caption">Positions are rebuilt from transactions using weighted-average cost.</div></div></div><form className="transaction-form" onSubmit={submit}><label>Symbol<input required value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="NVDA" /></label><label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label><label>Quantity<input required min="0" step="any" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Price<input required min="0" step="any" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>EUR</option><option>USD</option><option>CHF</option><option>GBP</option></select></label><label>Fees<input min="0" step="any" type="number" value={form.fees} onChange={(event) => setForm({ ...form, fees: event.target.value })} /></label><label>Date<input required type="datetime-local" value={form.executedAt} onChange={(event) => setForm({ ...form, executedAt: event.target.value })} /></label>{form.currency !== "EUR" ? <label>FX to EUR<input required min="0" step="any" type="number" value={form.fxRateToBase} onChange={(event) => setForm({ ...form, fxRateToBase: event.target.value })} placeholder="1.08" /></label> : null}<button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Add transaction"}</button></form>{message ? <div className="inline-error">{message}</div> : null}</section>
    <section className="hero-card"><div className="hero-label">Portfolio value</div><div className="hero-value">{formatMoney(summary.currentValue, summary.baseCurrency)} <span className="currency">{summary.baseCurrency}</span></div><div className="hero-meta"><div className="mini-stat"><span className="mini-stat-label">Invested</span><span className="mini-stat-value">{formatMoney(summary.investedCost, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Unrealized P/L</span><span className="mini-stat-value">{formatMoney(summary.pnl, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Performance</span><span className="mini-stat-value">{formatPercent(summary.performance)}</span></div><div className="mini-stat"><span className="mini-stat-label">Daily change</span><span className="mini-stat-value">{formatMoney(summary.dailyChange, summary.baseCurrency)}</span></div></div><div className="hero-note"><span className="status-dot" /><span>Data quality: <strong>{summary.dataQuality}</strong>. Missing quotes or FX rates are not converted into zero.</span></div></section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Positions</div><div className="panel-caption">Derived automatically from the transaction ledger</div></div></div>{summary.positions.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Quantity</th><th>Average Price</th><th>Current Price</th><th>Value</th><th>P/L</th><th>P/L %</th><th>Weight</th></tr></thead><tbody>{summary.positions.map((position) => <tr key={position.assetId ?? position.symbol}><td><Link className="table-primary" href={`/assets/${encodeURIComponent(position.symbol)}`}>{position.symbol}</Link><span className="table-secondary">{position.name ?? "—"}</span></td><td>{formatNumber(position.quantity, 6)}</td><td>{formatMoney(position.averagePrice, position.averagePriceCurrency ?? position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentPrice, position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentValue, summary.baseCurrency)}</td><td className={position.unrealizedPnl !== null && position.unrealizedPnl !== undefined && position.unrealizedPnl < 0 ? "negative" : "positive"}>{formatMoney(position.unrealizedPnl, summary.baseCurrency)}</td><td className={position.unrealizedPnlPercent !== null && position.unrealizedPnlPercent !== undefined && position.unrealizedPnlPercent < 0 ? "negative" : "positive"}>{formatPercent(position.unrealizedPnlPercent)}</td><td>{formatPercent(position.weight)}</td></tr>)}</tbody></table></div> : <div className="empty-center"><div className="empty-title">No positions yet</div><p className="empty-copy">Add a BUY transaction to calculate a position.</p></div>}</section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Transaction history</div><div className="panel-caption">The auditable source for every position</div></div></div>{transactions.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Asset</th><th>Type</th><th>Quantity</th><th>Price</th><th>Fees</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.executedAt)}</td><td>{transaction.symbol}</td><td>{transaction.type}</td><td>{formatNumber(transaction.quantity, 6)}</td><td>{formatMoney(transaction.unitPrice, transaction.currency)}</td><td>{formatMoney(transaction.fees, transaction.currency)}</td></tr>)}</tbody></table></div> : <div className="empty-center"><div className="empty-title">No transactions yet</div></div>}</section>
  </div>;
}

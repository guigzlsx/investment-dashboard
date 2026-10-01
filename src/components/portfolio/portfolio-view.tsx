"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { PortfolioSummary, PortfolioTransaction, PositionSummary } from "../../lib/portfolio/types";
import { transactionsForPosition } from "../../lib/portfolio/removal";
import { formatDate, formatMoney, formatNumber, formatPercent } from "../../lib/ui/format";

const emptySummary: PortfolioSummary = { baseCurrency: "EUR", investedCost: null, currentValue: null, pnl: null, performance: null, dailyChange: null, dataQuality: "UNKNOWN", positions: [] };

export function PortfolioView() {
  const [summary, setSummary] = useState<PortfolioSummary>(emptySummary);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [portfolioId, setPortfolioId] = useState<string | null>(null);
  const [form, setForm] = useState({ symbol: "", type: "BUY", quantity: "", price: "", currency: "EUR", fees: "0", fxRateToBase: "", executedAt: new Date().toISOString().slice(0, 16) });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [openPositionActions, setOpenPositionActions] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<PositionSummary | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removalError, setRemovalError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([fetch("/api/portfolio/summary"), fetch("/api/portfolio/transactions")]);
      const summaryBody = await summaryResponse.json() as { data?: PortfolioSummary; error?: { message?: string } };
      const transactionsBody = await transactionsResponse.json() as { data?: PortfolioTransaction[]; portfolio?: { id?: string }; error?: { message?: string } };
      if (!summaryResponse.ok) throw new Error(summaryBody.error?.message ?? "Portfolio unavailable");
      if (!transactionsResponse.ok) throw new Error(transactionsBody.error?.message ?? "Transactions unavailable");
      setSummary(summaryBody.data ?? emptySummary);
      setTransactions(transactionsBody.data ?? []);
      setPortfolioId(transactionsBody.portfolio?.id ?? null);
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

  function openTransactionForm(type: "BUY" | "SELL", position?: PositionSummary) {
    setOpenPositionActions(null);
    setForm((current) => ({
      ...current,
      symbol: position?.symbol ?? current.symbol,
      type,
      quantity: type === "SELL" && position ? String(position.quantity) : position ? "" : current.quantity,
      price: "",
    }));
    window.setTimeout(() => document.getElementById("transaction-form")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  function openRemoveConfirmation(position: PositionSummary) {
    setOpenPositionActions(null);
    setRemovalError("");
    setRemovalTarget(position);
  }

  function transactionCountFor(position: PositionSummary) {
    return position.assetId && portfolioId ? transactionsForPosition(transactions, portfolioId, position.assetId).length : transactions.filter((transaction) => transaction.symbol === position.symbol).length;
  }

  async function removePosition() {
    if (!removalTarget?.assetId || !portfolioId) {
      setRemovalError("This position cannot be removed because its portfolio identity is unavailable. Refresh and try again.");
      return;
    }
    setRemoving(true);
    setRemovalError("");
    try {
      const response = await fetch("/api/portfolio/positions/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolioId, assetId: removalTarget.assetId }),
      });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Position could not be removed");
      const removedSymbol = removalTarget.symbol;
      setRemovalTarget(null);
      setNotice(`${removedSymbol} was removed from your portfolio.`);
      await load();
    } catch (error) {
      setRemovalError(error instanceof Error ? error.message : "Position could not be removed");
    } finally {
      setRemoving(false);
    }
  }

  if (loading) return <section className="panel loading-panel">Loading portfolio…</section>;
  if (message && !transactions.length) return <section className="panel"><div className="empty-center"><div className="empty-title">Portfolio unavailable</div><p className="empty-copy">{message}</p><Link className="button" href="/login">Sign in to use your private portfolio</Link></div></section>;

  return <div className="portfolio-stack"><section className="panel" id="transaction-form"><div className="panel-header"><div><div className="panel-title">Add transaction</div><div className="panel-caption">Positions are rebuilt from transactions using weighted-average cost.</div></div><Link className="button button-secondary" href="/portfolio/import">Import portfolio</Link></div><form className="transaction-form" onSubmit={submit}><label>Symbol<input required value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} placeholder="NVDA" /></label><label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="BUY">BUY</option><option value="SELL">SELL</option></select></label><label>Quantity<input required min="0" step="any" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label><label>Price<input required min="0" step="any" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></label><label>Currency<select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option>EUR</option><option>USD</option><option>CHF</option><option>GBP</option></select></label><label>Fees<input min="0" step="any" type="number" value={form.fees} onChange={(event) => setForm({ ...form, fees: event.target.value })} /></label><label>Date<input required type="datetime-local" value={form.executedAt} onChange={(event) => setForm({ ...form, executedAt: event.target.value })} /></label>{form.currency !== "EUR" ? <label>FX to EUR<input required min="0" step="any" type="number" value={form.fxRateToBase} onChange={(event) => setForm({ ...form, fxRateToBase: event.target.value })} placeholder="1.08" /></label> : null}<button className="button button-primary" disabled={saving} type="submit">{saving ? "Saving…" : form.type === "SELL" ? "Record sale" : "Add transaction"}</button></form>{notice ? <div className="inline-message success">{notice}</div> : null}{message ? <div className="inline-error">{message}</div> : null}</section>
    <section className="hero-card"><div className="hero-label">Portfolio value</div><div className="hero-value">{formatMoney(summary.currentValue, summary.baseCurrency)} <span className="currency">{summary.baseCurrency}</span></div><div className="hero-meta"><div className="mini-stat"><span className="mini-stat-label">Invested</span><span className="mini-stat-value">{formatMoney(summary.investedCost, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Unrealized P/L</span><span className="mini-stat-value">{formatMoney(summary.pnl, summary.baseCurrency)}</span></div><div className="mini-stat"><span className="mini-stat-label">Performance</span><span className="mini-stat-value">{formatPercent(summary.performance)}</span></div><div className="mini-stat"><span className="mini-stat-label">Daily change</span><span className="mini-stat-value">{formatMoney(summary.dailyChange, summary.baseCurrency)}</span></div></div><div className="hero-note"><span className="status-dot" /><span>Data quality: <strong>{summary.dataQuality}</strong>. Missing quotes or FX rates are not converted into zero.</span></div></section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Positions</div><div className="panel-caption">Derived automatically from the transaction ledger</div></div></div>{summary.positions.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Company</th><th>Quantity</th><th>Average Price</th><th>Current Price</th><th>Value</th><th>P/L</th><th>P/L %</th><th>Weight</th><th aria-label="Actions" /></tr></thead><tbody>{summary.positions.map((position) => <tr key={position.assetId ?? position.symbol}><td><Link className="table-primary" href={`/assets/${encodeURIComponent(position.symbol)}`}>{position.symbol}</Link><span className="table-secondary">{position.name ?? "—"}</span></td><td>{formatNumber(position.quantity, 6)}</td><td>{formatMoney(position.averagePrice, position.averagePriceCurrency ?? position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentPrice, position.quoteCurrency ?? summary.baseCurrency)}</td><td>{formatMoney(position.currentValue, summary.baseCurrency)}</td><td className={position.unrealizedPnl !== null && position.unrealizedPnl !== undefined && position.unrealizedPnl < 0 ? "negative" : "positive"}>{formatMoney(position.unrealizedPnl, summary.baseCurrency)}</td><td className={position.unrealizedPnlPercent !== null && position.unrealizedPnlPercent !== undefined && position.unrealizedPnlPercent < 0 ? "negative" : "positive"}>{formatPercent(position.unrealizedPnlPercent)}</td><td>{formatPercent(position.weight)}</td><td className="position-actions-cell"><div className="position-actions"><button aria-expanded={openPositionActions === (position.assetId ?? position.symbol)} aria-haspopup="menu" aria-label={`Actions for ${position.symbol}`} className="position-actions-trigger" onClick={() => setOpenPositionActions((current) => current === (position.assetId ?? position.symbol) ? null : (position.assetId ?? position.symbol))} type="button">•••</button>{openPositionActions === (position.assetId ?? position.symbol) ? <div className="position-actions-menu" role="menu"><Link href={`/assets/${encodeURIComponent(position.symbol)}`} onClick={() => setOpenPositionActions(null)} role="menuitem">View asset</Link><button onClick={() => openTransactionForm("BUY", position)} role="menuitem" type="button">Add transaction</button><button onClick={() => openTransactionForm("SELL", position)} role="menuitem" type="button">Sell</button><button className="destructive-action" onClick={() => openRemoveConfirmation(position)} role="menuitem" type="button">Remove from portfolio</button></div> : null}</div></td></tr>)}</tbody></table></div> : <div className="empty-center"><div className="empty-title">No positions yet</div><p className="empty-copy">Add a BUY transaction to calculate a position.</p></div>}</section>
    <section className="panel"><div className="panel-header"><div><div className="panel-title">Transaction history</div><div className="panel-caption">The auditable source for every position</div></div></div>{transactions.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Asset</th><th>Type</th><th>Quantity</th><th>Price</th><th>Fees</th></tr></thead><tbody>{transactions.map((transaction) => <tr key={transaction.id}><td>{formatDate(transaction.executedAt)}</td><td>{transaction.symbol}</td><td>{transaction.type}</td><td>{formatNumber(transaction.quantity, 6)}</td><td>{formatMoney(transaction.unitPrice, transaction.currency)}</td><td>{formatMoney(transaction.fees, transaction.currency)}</td></tr>)}</tbody></table></div> : <div className="empty-center"><div className="empty-title">No transactions yet</div></div>}</section>
    {removalTarget ? <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target && !removing) setRemovalTarget(null); }} role="presentation"><section aria-labelledby="remove-position-title" aria-modal="true" className="confirmation-modal" role="dialog"><div className="modal-eyebrow">Data correction</div><h2 id="remove-position-title">Remove {removalTarget.symbol} from portfolio?</h2><p className="modal-copy">This will remove {removalTarget.symbol} and its associated portfolio transactions.</p><div className="removal-summary"><div><span>Current position</span><strong>{formatNumber(removalTarget.quantity, 6)} {removalTarget.symbol}</strong></div><div><span>Transactions</span><strong>{transactionCountFor(removalTarget)}</strong></div></div><p className="modal-warning">This action affects your portfolio history and performance calculations. If you actually sold this investment, record a Sell transaction instead.</p>{removalError ? <div className="inline-error">{removalError}</div> : null}<div className="modal-actions"><button className="button" disabled={removing} onClick={() => { setRemovalTarget(null); setRemovalError(""); }} type="button">Cancel</button><button className="button button-secondary" disabled={removing} onClick={() => { const target = removalTarget; setRemovalTarget(null); setRemovalError(""); openTransactionForm("SELL", target); }} type="button">Record a sale instead</button><button className="button button-danger" disabled={removing} onClick={() => void removePosition()} type="button">{removing ? "Removing…" : `Remove ${removalTarget.symbol}`}</button></div></section></div> : null}
  </div>;
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dataStatus, formatMoney, formatPercent, formatNumber } from "../../lib/ui/format";

type WatchlistRow = { id: string; asset: { symbol: string; name?: string | null; currency?: string | null }; quote: { price: number | null; change1DPercent: number | null; marketCap: number | null; provenance: { dataKind: string } } | null; metrics: { pe: number | null; revenueGrowth: number | null } | null };

export function WatchlistView() {
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/watchlist").then(async (response) => {
      const body = await response.json() as { data?: WatchlistRow[]; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Watchlist unavailable");
      if (!cancelled) setRows(body.data ?? []);
    }).catch((error: unknown) => { if (!cancelled) setMessage(error instanceof Error ? error.message : "Watchlist unavailable"); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function remove(id: string) {
    const response = await fetch(`/api/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) setRows((current) => current.filter((row) => row.id !== id));
  }

  if (loading) return <section className="panel loading-panel">Loading watchlist…</section>;
  if (message) return <section className="panel"><div className="empty-center"><div className="empty-title">Watchlist unavailable</div><p className="empty-copy">{message}</p><Link className="button" href="/login">Sign in to use your private watchlist</Link></div></section>;
  if (!rows.length) return <section className="panel"><div className="empty-center"><div className="empty-title">Your watchlist is empty</div><p className="empty-copy">Use the global search to find an asset, then save it from its fiche.</p><Link className="button button-primary" href="/dashboard">Search an asset</Link></div></section>;

  return <section className="panel"><div className="panel-header"><div><div className="panel-title">Saved assets</div><div className="panel-caption">Provider data · missing values remain visible as —</div></div><span className="date-note">{rows.length} asset{rows.length > 1 ? "s" : ""}</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Price</th><th>1D</th><th>Market Cap</th><th>P/E</th><th>Revenue Growth</th><th>Data</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link className="table-primary" href={`/assets/${encodeURIComponent(row.asset.symbol)}`}>{row.asset.symbol}</Link><span className="table-secondary">{row.asset.name ?? "—"}</span></td><td>{formatMoney(row.quote?.price, row.asset.currency ?? "EUR")}</td><td className={row.quote?.change1DPercent !== null && row.quote?.change1DPercent !== undefined && row.quote.change1DPercent < 0 ? "negative" : "positive"}>{formatPercent(row.quote?.change1DPercent)}</td><td>{formatMoney(row.quote?.marketCap, row.asset.currency ?? "EUR")}</td><td>{formatNumber(row.metrics?.pe)}</td><td>{formatPercent(row.metrics?.revenueGrowth)}</td><td>{dataStatus(row.quote?.provenance.dataKind)}</td><td><button className="table-action" onClick={() => void remove(row.id)}>Remove</button></td></tr>)}</tbody></table></div></section>;
}

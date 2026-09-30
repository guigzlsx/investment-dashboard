"use client";

import { useEffect, useState } from "react";
import { SCENARIO_PRESETS } from "../../lib/portfolio/scenario-presets";
import type { ScenarioResult } from "../../lib/portfolio/scenarios";
import type { PortfolioSummary, PositionSummary } from "../../lib/portfolio/types";
import { formatMoney, formatPercent } from "../../lib/ui/format";

type ShockRow = { key: string; label: string; shock: string };

function Result({ result, currency }: { result: ScenarioResult; currency: string }) {
  return <section className="panel scenario-result"><div className="panel-header"><div><div className="panel-title">Scenario result</div><div className="panel-caption">Mechanical estimate, not a prediction</div></div><span className="date-note">{result.dataQuality}</span></div><div className="scenario-metrics"><div><span>Current portfolio</span><strong>{formatMoney(result.baselineValue, currency)}</strong></div><div><span>Estimated after</span><strong>{formatMoney(result.estimatedValue, currency)}</strong></div><div><span>Estimated impact</span><strong className={result.impact !== null && result.impact < 0 ? "negative" : "positive"}>{formatMoney(result.impact, currency)}</strong></div><div><span>Portfolio impact</span><strong className={result.impactPercent !== null && result.impactPercent < 0 ? "negative" : "positive"}>{formatPercent(result.impactPercent)}</strong></div></div>{result.assumptions.map((assumption) => <p className="scenario-assumption" key={assumption}>{assumption}</p>)}{result.rows.length ? <div className="scenario-rows">{result.rows.map((row) => <div className="scenario-row" key={row.key}><span>{row.label}</span><span>{formatPercent(row.shock)} · {formatMoney(row.impact, currency)}</span></div>)}</div> : null}</section>;
}

export function ScenarioView() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [positions, setPositions] = useState<PositionSummary[]>([]);
  const [rows, setRows] = useState<ShockRow[]>([{ key: "", label: "", shock: "-20" }]);
  const [fxCurrency, setFxCurrency] = useState("USD");
  const [fxShock, setFxShock] = useState("-10");
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/portfolio/scenarios").then(async (response) => { const body = await response.json() as { data?: { summary: PortfolioSummary; positions: PositionSummary[] }; error?: { message?: string } }; if (!response.ok) throw new Error(body.error?.message ?? "Scenario data unavailable"); setSummary(body.data?.summary ?? null); setPositions(body.data?.positions ?? []); }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Scenario data unavailable")); }, 0); return () => window.clearTimeout(timer); }, []);

  async function run(shocks: ShockRow[] = rows) {
    setMessage("");
    const payload = shocks.map((row) => ({ key: row.key, label: row.label || row.key, shock: Number(row.shock) / 100 })).filter((row) => row.key && Number.isFinite(row.shock));
    const response = await fetch("/api/portfolio/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shocks: payload }) });
    const body = await response.json() as { data?: ScenarioResult; error?: { message?: string } };
    if (!response.ok) throw new Error(body.error?.message ?? "Scenario could not be calculated");
    setResult(body.data ?? null);
  }

  async function runFx() {
    try {
      const response = await fetch("/api/portfolio/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fx: { currency: fxCurrency, shock: Number(fxShock) / 100 } }) });
      const body = await response.json() as { data?: ScenarioResult; error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "FX scenario could not be calculated");
      setResult(body.data ?? null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "FX scenario could not be calculated"); }
  }

  function applyPreset(key: string) {
    const preset = SCENARIO_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    if (key === "usd-weakness") { void runFx(); return; }
    const next = positions.filter(preset.matcher).map((position) => ({ key: position.assetId ?? position.symbol, label: position.symbol, shock: String(preset.shock * 100) }));
    setRows(next.length ? next : [{ key: "", label: "", shock: String(preset.shock * 100) }]);
    if (!next.length) setMessage("No position matches this preset because the required classification is unavailable.");
    else void run(next);
  }

  if (message && !summary) return <section className="panel"><div className="empty-center"><div className="empty-title">Scenarios unavailable</div><p className="empty-copy">{message}</p></div></section>;
  return <div className="scenario-stack"><section className="panel"><div className="panel-header"><div><div className="panel-title">Asset scenario</div><div className="panel-caption">Apply independent shocks to one or several positions.</div></div></div><div className="preset-list">{SCENARIO_PRESETS.map((preset) => <button className="button" key={preset.key} onClick={() => applyPreset(preset.key)} title={preset.description}>{preset.label}</button>)}</div><div className="scenario-form">{rows.map((row, index) => <div className="scenario-input-row" key={`${row.key}-${index}`}><select value={row.key} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, key: event.target.value, label: event.target.value } : item))}><option value="">Select asset</option>{positions.map((position) => <option key={position.assetId ?? position.symbol} value={position.assetId ?? position.symbol}>{position.symbol}</option>)}</select><input aria-label="Variation percent" type="number" value={row.shock} onChange={(event) => setRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, shock: event.target.value } : item))} /><span>%</span><button className="table-action" onClick={() => setRows(rows.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}</div><div className="scenario-actions"><button className="button" onClick={() => setRows([...rows, { key: "", label: "", shock: "-10" }])}>Add asset</button><button className="button button-primary" onClick={() => void run()}>Calculate scenario</button></div></section><section className="panel"><div className="panel-header"><div><div className="panel-title">FX scenario</div><div className="panel-caption">Asset prices remain unchanged; only currency translation moves.</div></div></div><div className="scenario-input-row"><select value={fxCurrency} onChange={(event) => setFxCurrency(event.target.value)}><option>USD</option><option>CHF</option><option>GBP</option><option>EUR</option></select><input aria-label="FX variation percent" type="number" value={fxShock} onChange={(event) => setFxShock(event.target.value)} /><span>%</span><button className="button button-primary" onClick={() => void runFx()}>Calculate FX</button></div></section>{result ? <Result currency={summary?.baseCurrency ?? "EUR"} result={result} /> : <div className="panel"><div className="empty-center"><div className="empty-title">Choose a shock to begin</div><p className="empty-copy">The result uses current position values and shows its assumptions.</p></div></div>}</div>;
}

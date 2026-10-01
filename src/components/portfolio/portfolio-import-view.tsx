"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { ImportColumnField, ImportColumnMapping, NormalizedImportedTransaction, PortfolioImportPreview } from "../../lib/portfolio-import/types";
import { importRowAction } from "../../lib/portfolio-import/presentation";

const mappingOptions: Array<{ value: ImportColumnField; label: string }> = [
  { value: "ignore", label: "Ignore" }, { value: "ticker", label: "Ticker / symbol" }, { value: "isin", label: "ISIN" }, { value: "name", label: "Asset name" }, { value: "exchange", label: "Exchange" }, { value: "transactionType", label: "Transaction type" }, { value: "quantity", label: "Quantity" }, { value: "price", label: "Price" }, { value: "currency", label: "Currency" }, { value: "fxRateToBase", label: "FX rate to base" }, { value: "fees", label: "Fees" }, { value: "date", label: "Date" },
];
type Filter = "ALL" | "READY" | "WARNING" | "ERROR";

function rowLabel(row: NormalizedImportedTransaction) { return row.symbol || row.name || row.assetIdentifier || "Unknown asset"; }
function statusLabel(row: NormalizedImportedTransaction) { if (row.assetResolution?.reason === "PROVIDER_ERROR") return "Error"; if (row.assetResolution?.reason === "INVALID_SYMBOL") return "Not found"; if (row.assetResolution?.reason === "UNSUPPORTED_ASSET") return "Error"; if (row.assetResolution?.reason === "AMBIGUOUS") return "Needs review"; return row.status === "READY" ? "Ready" : row.status === "WARNING" ? "Review" : row.status === "DUPLICATE" ? "Possible duplicate" : row.status === "UNSUPPORTED" ? "Unsupported" : "Needs review"; }
function statusClass(row: NormalizedImportedTransaction) { if (row.assetResolution?.reason === "AMBIGUOUS") return "warning"; if (["PROVIDER_ERROR", "INVALID_SYMBOL", "UNSUPPORTED_ASSET"].includes(row.assetResolution?.reason ?? "")) return "error"; return row.status.toLowerCase(); }
function candidateLabel(candidate: NonNullable<NormalizedImportedTransaction["assetResolution"]>["candidates"][number]) { return [candidate.name, candidate.symbol, candidate.exchange, candidate.currency].filter(Boolean).join(" · "); }
function rowNote(row: NormalizedImportedTransaction) { if (row.assetResolution?.reason === "PROVIDER_ERROR" && row.assetResolution.providerErrorCode === "RATE_LIMIT") return "Market data rate limit reached"; if (row.assetResolution?.reason === "PROVIDER_ERROR") return "Market data provider unavailable"; if (row.assetResolution?.reason === "INVALID_SYMBOL") return "Asset not found"; if (row.assetResolution?.reason === "UNSUPPORTED_ASSET") return "Asset not supported for this listing"; if (row.assetResolution?.reason === "AMBIGUOUS") return `${row.assetResolution.candidates.length} matching assets found`; return [...row.errors, ...row.warnings].join(" · ") || `Confidence ${row.confidence}`; }

export function PortfolioImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PortfolioImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [sheet, setSheet] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "success">("upload");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [busy, setBusy] = useState(false);
  const [retryingRow, setRetryingRow] = useState<number | null>(null);
  const retryRequestInFlight = useRef(false);
  const [retryFeedback, setRetryFeedback] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [commitSummary, setCommitSummary] = useState<{ transactionsImported: number; assetsAdded: number; duplicatesSkipped: number; rowsIgnored: number; warnings: number } | null>(null);

  const filteredRows = useMemo(() => {
    const rows = preview?.rows ?? [];
    if (filter === "ALL") return rows;
    if (filter === "READY") return rows.filter((row) => row.status === "READY" || row.status === "DUPLICATE");
    if (filter === "WARNING") return rows.filter((row) => row.status === "WARNING" || row.status === "DUPLICATE" || row.warnings.length > 0);
    return rows.filter((row) => row.status === "ERROR" || row.status === "UNSUPPORTED");
  }, [filter, preview]);

  function onFileChange(nextFile: File | null) { setFile(nextFile); setPreview(null); setMapping({}); setSelections({}); setRetryFeedback({}); setMessage(""); setStep(nextFile ? "mapping" : "upload"); }
  function updateMapping(column: string, value: ImportColumnField) {
    setMapping((current) => { const next = { ...current, [column]: value }; if (value !== "ignore") for (const [other, field] of Object.entries(next)) if (other !== column && field === value) next[other] = "ignore"; return next; });
  }
  async function analyze(options: { selectionOverride?: Record<string, string>; retrySourceRow?: number } = {}) {
    if (!file) return;
    const retrySourceRow = options.retrySourceRow;
    if (retrySourceRow !== undefined) {
      if (retryRequestInFlight.current) return;
      retryRequestInFlight.current = true;
    }
    setBusy(true); setMessage("");
    if (retrySourceRow !== undefined) {
      setRetryingRow(retrySourceRow);
      setRetryFeedback((current) => ({ ...current, [String(retrySourceRow)]: "Retrying…" }));
    }
    try {
      const form = new FormData(); form.set("file", file); if (preview?.importId) form.set("importId", preview.importId); if (retrySourceRow !== undefined) form.set("retrySourceRow", String(retrySourceRow)); if (sheet) form.set("sheet", sheet); if (Object.keys(mapping).length) form.set("mapping", JSON.stringify(mapping)); if (Object.keys(options.selectionOverride ?? selections).length) form.set("selections", JSON.stringify(options.selectionOverride ?? selections));
      const response = await fetch("/api/portfolio/import/preview", { method: "POST", body: form });
      const body = await response.json() as { data?: PortfolioImportPreview; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "We couldn't analyze this file.");
      setPreview(body.data); setMapping(body.data.mapping); setSheet(body.data.selectedSheet ?? ""); setStep(Object.keys(body.data.mapping).length ? "preview" : "mapping");
      if (retrySourceRow !== undefined) {
        const retried = body.data.rows.find((row) => row.sourceRow === retrySourceRow);
        const feedback = retried?.assetResolution?.reason === "PROVIDER_ERROR"
          ? `Retry failed — ${retried.assetResolution.providerErrorCode === "RATE_LIMIT" ? "market data rate limit reached" : "market data provider unavailable"}.`
          : retried?.assetResolution?.reason === "AMBIGUOUS"
            ? "Retry completed — multiple matching assets found."
            : retried?.status === "READY" || retried?.status === "WARNING" || retried?.status === "DUPLICATE"
              ? "Resolution updated."
              : "Retry completed.";
        setRetryFeedback((current) => ({ ...current, [String(retrySourceRow)]: feedback }));
      }
    } catch (error) {
      if (retrySourceRow !== undefined) setRetryFeedback((current) => ({ ...current, [String(retrySourceRow)]: `Retry failed — ${error instanceof Error ? error.message : "request unavailable"}.` }));
      else setMessage(error instanceof Error ? error.message : "We couldn't analyze this file.");
    } finally {
      if (retrySourceRow !== undefined) retryRequestInFlight.current = false;
      setRetryingRow(null); setBusy(false);
    }
  }
  async function commit() {
    if (!preview) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/portfolio/import/commit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ importId: preview.importId, skipDuplicates }) });
      const body = await response.json() as { data?: { transactionsImported: number; assetsAdded: number; duplicatesSkipped: number; rowsIgnored: number; warnings: number }; error?: { message?: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Import could not be completed.");
      setCommitSummary(body.data); setStep("success");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import could not be completed."); }
    finally { setBusy(false); }
  }
  function chooseAsset(row: NormalizedImportedTransaction, value: string) { const next = { ...selections, [String(row.sourceRow)]: value }; setSelections(next); window.setTimeout(() => { void analyze({ selectionOverride: next }); }, 0); }
  function rowAction(row: NormalizedImportedTransaction) { return importRowAction(row); }
  function actionView(row: NormalizedImportedTransaction, feedback?: string) {
    const action = rowAction(row);
    const visibleFeedback = retryingRow === row.sourceRow ? undefined : feedback;
    if (action === "CHOOSE_ASSET") return <div className="import-action-stack"><select aria-label={`Choose asset for ${rowLabel(row)}`} className="import-asset-choice" disabled={busy} value={selections[String(row.sourceRow)] ?? ""} onChange={(event) => chooseAsset(row, event.target.value)}><option value="">Choose asset</option>{row.assetResolution?.candidates.map((candidate) => <option key={`${candidate.id ?? candidate.symbol}|${candidate.exchange ?? ""}`} value={candidate.id ?? `${candidate.symbol}|${candidate.exchange ?? ""}`}>{candidateLabel(candidate)}</option>)}</select>{visibleFeedback ? <span className="import-action-feedback" role="status">{visibleFeedback}</span> : null}</div>;
    if (action === "RETRY") return <div className="import-action-stack"><button aria-busy={retryingRow === row.sourceRow} className="button button-secondary import-retry" disabled={busy || retryingRow === row.sourceRow} onClick={() => void analyze({ retrySourceRow: row.sourceRow })} type="button">{retryingRow === row.sourceRow ? <><span aria-hidden="true" className="import-spinner" />Retrying…</> : "Retry"}</button>{visibleFeedback ? <span className="import-action-feedback" role="status">{visibleFeedback}</span> : null}</div>;
    return visibleFeedback ? <span className="import-action-feedback" role="status">{visibleFeedback}</span> : "—";
  }

  return <div className="import-stack">
    <section className="panel import-intro"><div className="eyebrow">PORTFOLIO IMPORT</div><h2>Bring your existing portfolio in</h2><p className="body-copy">Upload a broker export, review every normalized transaction, and only then add it to your portfolio ledger.</p><div className="import-stepper"><span className={step === "upload" ? "active" : "complete"}>1 Upload</span><span className={step === "mapping" ? "active" : step === "preview" || step === "success" ? "complete" : ""}>2 Map columns</span><span className={step === "preview" ? "active" : step === "success" ? "complete" : ""}>3 Review</span><span className={step === "success" ? "active" : ""}>4 Import</span></div></section>
    {step === "upload" ? <section className="panel import-upload-panel"><label className="import-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFileChange(event.dataTransfer.files?.[0] ?? null); }}><input accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" type="file" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} /><span className="import-upload-icon">↑</span><strong>Drop your file here</strong><span>or choose a CSV or XLSX export</span><b>CSV and XLSX · max 10 MB</b></label><div className="import-actions"><a className="button button-secondary" href="/api/portfolio/import/template">Download generic template</a></div></section> : null}
    {step === "mapping" && preview ? <section className="panel"><div className="panel-header"><div><div className="panel-title">Check detected columns</div><div className="panel-caption">{preview.fileName} · {preview.rows.length} transaction rows{preview.detectedPreset ? ` · Broker detected: ${preview.detectedPreset}` : ""}</div></div><button className="button button-primary" disabled={busy} onClick={() => void analyze()} type="button">{busy ? "Analyzing…" : "Preview transactions"}</button></div>{preview.sheetNames.length > 1 ? <label className="import-sheet-select">Sheet<select value={sheet} onChange={(event) => { setSheet(event.target.value); setPreview(null); setMapping({}); }}><option value="">Choose a sheet</option>{preview.sheetNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}<div className="mapping-grid">{preview.columns.map((column) => <label key={column}><span>{column}</span><select value={mapping[column] ?? "ignore"} onChange={(event) => updateMapping(column, event.target.value as ImportColumnField)}>{mappingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}</div><div className="import-note">The original file is not stored. Only the temporary normalized import session is kept until confirmation.</div></section> : null}
    {step === "preview" && preview ? <section className="import-preview-stack"><section className="panel"><div className="panel-header"><div><div className="panel-title">Preview and resolve problems</div><div className="panel-caption">{preview.fileName} · {preview.format}{preview.selectedSheet ? ` · ${preview.selectedSheet}` : ""}{preview.detectedPreset ? ` · Broker detected: ${preview.detectedPreset}` : ""}</div></div><div className="panel-actions"><button className="button button-secondary" disabled={busy} onClick={() => setStep("mapping")} type="button">Edit mapping</button><button className="button button-primary" disabled={busy || preview.summary.ready === 0} onClick={() => void commit()} type="button">{busy ? "Importing…" : "Confirm import"}</button></div></div><div className="import-summary-grid"><div><strong>{preview.summary.total}</strong><span>Transactions detected</span></div><div className="positive"><strong>{preview.summary.ready}</strong><span>Ready</span></div><div className="warning"><strong>{preview.summary.warnings}</strong><span>Warnings</span></div><div className="negative"><strong>{preview.summary.errors + preview.summary.unsupported}</strong><span>Needs review</span></div><div><strong>{preview.summary.duplicates}</strong><span>Possible duplicates</span></div><div className="import-cash-ignored"><strong>{preview.summary.cashIgnored}</strong><span>Cash operations ignored</span></div></div><div className="import-filters">{(["ALL", "READY", "WARNING", "ERROR"] as Filter[]).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)} type="button">{value === "ALL" ? `All (${preview.summary.total})` : value === "READY" ? `Ready (${preview.summary.ready})` : value === "WARNING" ? `Warnings (${preview.summary.warnings})` : `Errors (${preview.summary.errors + preview.summary.unsupported})`}</button>)}</div></section><section className="panel import-table-panel"><div className="data-table-wrap import-preview-table"><table className="data-table"><thead><tr><th>Status</th><th>Asset</th><th>Type</th><th>Quantity</th><th>Price</th><th>Currency</th><th>Date</th><th>Notes</th><th>Action</th></tr></thead><tbody>{filteredRows.map((row) => { const feedback = retryFeedback[String(row.sourceRow)]; return <tr key={row.sourceRow}><td><span className={`import-status ${statusClass(row)}`}>{statusLabel(row)}</span></td><td><strong>{rowLabel(row)}</strong></td><td>{row.transactionType ?? "—"}</td><td>{row.quantity ?? "—"}</td><td>{row.price ?? "—"}</td><td>{row.currency ?? "—"}</td><td>{row.transactionDate?.slice(0, 10) ?? "—"}</td><td>{rowNote(row)}</td><td className="import-action-cell">{actionView(row, feedback)}</td></tr>; })}</tbody></table></div><div className="import-mobile-rows">{filteredRows.map((row) => { const feedback = retryFeedback[String(row.sourceRow)]; return <article className="import-mobile-row" key={row.sourceRow}><div><span className={`import-status ${statusClass(row)}`}>{statusLabel(row)}</span><strong>{rowLabel(row)}</strong></div><span>{row.transactionType ?? "—"} · {row.quantity ?? "—"} × {row.price ?? "—"} {row.currency ?? ""}</span><small>{row.transactionDate?.slice(0, 10) ?? "—"} · {rowNote(row)}</small>{actionView(row, feedback)}</article>; })}</div><div className="import-duplicate-option"><label><input checked={skipDuplicates} onChange={(event) => setSkipDuplicates(event.target.checked)} type="checkbox" /> Skip possible duplicates automatically</label><span>Rows with errors will be ignored; warnings can still be imported after review.</span></div></section></section> : null}
    {step === "success" && commitSummary ? <section className="panel import-success"><div className="success-mark">✓</div><div className="eyebrow">PORTFOLIO IMPORTED</div><h2>Your portfolio has been updated</h2><div className="import-summary-grid"><div><strong>{commitSummary.transactionsImported}</strong><span>Transactions imported</span></div><div><strong>{commitSummary.assetsAdded}</strong><span>Assets added</span></div><div><strong>{commitSummary.duplicatesSkipped}</strong><span>Duplicates skipped</span></div><div><strong>{commitSummary.rowsIgnored}</strong><span>Rows ignored</span></div><div><strong>{commitSummary.warnings}</strong><span>Warnings</span></div></div><div className="import-actions"><Link className="button button-primary" href="/portfolio">View portfolio</Link><button className="button button-secondary" onClick={() => { setFile(null); setPreview(null); setCommitSummary(null); setStep("upload"); }} type="button">Import another file</button></div></section> : null}
    {message ? <div className="inline-error">{message}</div> : null}
    {file && step === "mapping" && !preview ? <section className="panel import-file-ready"><strong>{file.name}</strong><span>{Math.round(file.size / 1024)} KB ready to analyze.</span><button className="button button-primary" disabled={busy} onClick={() => void analyze()} type="button">{busy ? "Reading file…" : "Detect columns"}</button></section> : null}
    <div className="import-back-link"><Link href="/portfolio">← Back to portfolio</Link></div>
  </div>;
}

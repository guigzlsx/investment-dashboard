"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "../../lib/ui/format";

type Note = { id: string; thesis: string | null; horizon: string | null; risks: string | null; invalidation_conditions: string | null; target_expectations: string | null; personal_notes: string | null; review_status: string; created_at: string; updated_at: string };

const initialForm = { thesis: "", horizon: "", risks: "", invalidationConditions: "", targetExpectations: "", personalNotes: "" };

export function InvestmentJournal({ symbol }: { symbol: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/assets/${encodeURIComponent(symbol)}/notes`);
    if (!response.ok) return;
    const body = await response.json() as { data?: Note[] };
    setNotes(body.data ?? []);
  }, [symbol]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/assets/${encodeURIComponent(symbol)}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message ?? "Note could not be saved");
      setForm(initialForm); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Note could not be saved"); }
    finally { setSaving(false); }
  }

  async function review(noteId: string, reviewStatus: string) {
    const response = await fetch(`/api/assets/${encodeURIComponent(symbol)}/notes`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ noteId, reviewStatus }) });
    if (response.ok) await load();
  }

  return <section className="panel journal-panel"><div className="panel-header"><div><div className="panel-title">Investment thesis</div><div className="panel-caption">Your interpretation stays separate from provider facts.</div></div></div><div className="journal-form"><label>Why did I buy?<textarea value={form.thesis} onChange={(event) => setForm({ ...form, thesis: event.target.value })} /></label><label>Investment horizon<input value={form.horizon} onChange={(event) => setForm({ ...form, horizon: event.target.value })} /></label><label>Main risks<textarea value={form.risks} onChange={(event) => setForm({ ...form, risks: event.target.value })} /></label><label>What would invalidate my thesis?<textarea value={form.invalidationConditions} onChange={(event) => setForm({ ...form, invalidationConditions: event.target.value })} /></label><label>Target / expectations<textarea value={form.targetExpectations} onChange={(event) => setForm({ ...form, targetExpectations: event.target.value })} /></label><label>Personal notes<textarea value={form.personalNotes} onChange={(event) => setForm({ ...form, personalNotes: event.target.value })} /></label><button className="button button-primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save thesis"}</button></div>{message ? <div className="inline-error">{message}</div> : null}{notes.length ? <div className="journal-list">{notes.map((note) => <article className="journal-entry" key={note.id}><div className="journal-entry-header"><strong>{note.review_status}</strong><span>Created {formatDate(note.created_at)} · Updated {formatDate(note.updated_at)}</span></div>{note.thesis ? <p><b>Thesis</b>{note.thesis}</p> : null}{note.risks ? <p><b>Risks</b>{note.risks}</p> : null}<div className="review-actions"><span>Review thesis:</span>{["UNCHANGED", "STRENGTHENED", "WEAKENED", "INVALIDATED"].map((status) => <button className="table-action" key={status} onClick={() => void review(note.id, status)}>{status}</button>)}</div></article>)}</div> : <div className="empty-copy">No thesis saved for this asset yet.</div>}</section>;
}

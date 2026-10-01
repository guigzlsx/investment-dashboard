"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssistantProvenance } from "../../lib/assistant/types";

type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
type Card = { type: string; title: string; data: unknown };
type Message = { id: string; role: "user" | "assistant"; content: string; sources: AssistantProvenance[]; cards: Card[]; pending?: boolean };

const suggestions = ["Analyze my portfolio", "What are my main risks?", "Analyze NVIDIA", "Compare NVIDIA and Marvell", "What if NVIDIA falls 20%?", "Analyze my watchlist"];

function id() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function value(valueToFormat: unknown) {
  if (valueToFormat === null || valueToFormat === undefined || valueToFormat === "") return "—";
  if (typeof valueToFormat === "number") return valueToFormat.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return String(valueToFormat);
}

function sourceLabel(source: AssistantProvenance) {
  return `${source.source}${source.freshness === "CURRENT" ? " · current" : source.freshness === "FRESH" ? " · fresh" : source.freshness === "STALE" ? " · delayed" : ""}`;
}

function CardView({ card }: { card: Card }) {
  const data = card.data && typeof card.data === "object" && !Array.isArray(card.data) ? card.data as Record<string, unknown> : {};
  if (card.type === "scenario") {
    const scenario = (data.symbol ? data : data.result && typeof data.result === "object" ? data.result : data) as Record<string, unknown>;
    return <article className="conversation-card"><div className="conversation-card-label">Scenario</div><strong>{value(data.symbol ?? "Portfolio scenario")}</strong><div className="conversation-card-grid"><span>Current <b>{value(scenario.currentPortfolioValue ?? scenario.baselineValue)}</b></span><span>Estimated <b>{value(scenario.estimatedPortfolioValue ?? scenario.estimatedValue)}</b></span><span>Impact <b>{value(scenario.absoluteImpact ?? scenario.impact)}</b></span><span>Impact % <b>{value(scenario.percentageImpact ?? scenario.impactPercent)}</b></span></div></article>;
  }
  if (card.type === "comparison") {
    const metrics = Array.isArray(data.metrics) ? data.metrics as Array<{ metric?: unknown; values?: Record<string, unknown>; difference?: unknown }> : [];
    return <article className="conversation-card"><div className="conversation-card-label">Comparison</div><strong>{Array.isArray(data.symbols) ? data.symbols.map(String).join(" · ") : "Assets"}</strong><div className="conversation-comparison">{metrics.slice(0, 8).map((metric, index) => <div key={`${String(metric.metric)}-${index}`}><span>{value(metric.metric)}</span><b>{Object.entries(metric.values ?? {}).map(([symbol, item]) => `${symbol}: ${value(item)}`).join(" · ")}</b><small>Difference: {value(metric.difference)}</small></div>)}</div></article>;
  }
  if (card.type === "position") return <article className="conversation-card"><div className="conversation-card-label">Your position</div><strong>{value(data.symbol)}</strong><div className="conversation-card-grid"><span>Quantity <b>{value(data.quantity)}</b></span><span>Value <b>{value(data.currentValue)}</b></span><span>P/L <b>{value(data.unrealizedPnl)}</b></span><span>Weight <b>{value(data.weight)}</b></span></div></article>;
  if (card.type === "portfolioSummary") {
    const summary = data.summary && typeof data.summary === "object" ? data.summary as Record<string, unknown> : data;
    return <article className="conversation-card"><div className="conversation-card-label">Portfolio summary</div><div className="conversation-card-grid"><span>Value <b>{value(summary.currentValue)}</b></span><span>Invested <b>{value(summary.investedCost)}</b></span><span>P/L <b>{value(summary.pnl)}</b></span><span>Performance <b>{value(summary.performance)}</b></span></div></article>;
  }
  const risks = Array.isArray(data.risks) ? data.risks : data.health && typeof data.health === "object" ? Object.entries(data.health as Record<string, unknown>).filter(([, item]) => Array.isArray(item)).flatMap(([, item]) => item as unknown[]) : [];
  return <article className="conversation-card"><div className="conversation-card-label">Structured risk data</div><div className="conversation-risk-list">{risks.slice(0, 6).map((risk, index) => <span key={index}>{risk && typeof risk === "object" ? value((risk as Record<string, unknown>).category ?? (risk as Record<string, unknown>).key) : value(risk)}</span>)}</div></article>;
}

function followUps(intent: string | null) {
  if (intent === "SCENARIO") return ["Explain the scenario assumptions", "Show my portfolio concentration"];
  if (intent === "COMPARISON") return ["Analyze NVIDIA", "Analyze Marvell"];
  if (intent === "POSITION_ANALYSIS" || intent === "ASSET_ANALYSIS") return ["Simulate a -20% scenario", "Review my investment thesis"];
  return ["Analyze my portfolio", "What are my main risks?"];
}

export function AssistantView() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [analysisDepth, setAnalysisDepth] = useState<"QUICK" | "DETAILED">("QUICK");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lastIntent, setLastIntent] = useState<string | null>(null);

  async function loadConversations() {
    const response = await fetch("/api/assistant/conversations");
    if (!response.ok) return;
    const body = await response.json() as { data?: Conversation[] };
    setConversations(body.data ?? []);
  }

  async function openConversation(nextId: string) {
    const response = await fetch(`/api/assistant/conversations?conversationId=${encodeURIComponent(nextId)}`);
    if (!response.ok) return;
    const body = await response.json() as { data?: Array<{ id: string; role: "user" | "assistant"; content: string; provenance?: AssistantProvenance[]; structuredData?: { cards?: Card[] } | null; structured_data?: { cards?: Card[] } | null }> };
    setConversationId(nextId);
    setMessages((body.data ?? []).map((item) => ({ id: item.id, role: item.role, content: item.content, sources: item.provenance ?? [], cards: item.structuredData?.cards ?? item.structured_data?.cards ?? [] })));
    setError("");
    setLastIntent(null);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadConversations();
      void fetch("/api/profile").then((response) => response.ok ? response.json() as Promise<{ data?: { default_analysis_depth?: string } }> : null).then((body) => {
        if (body?.data?.default_analysis_depth === "DETAILED") setAnalysisDepth("DETAILED");
      }).catch(() => undefined);
      const prompt = new URLSearchParams(window.location.search).get("prompt");
      if (prompt) setQuery(prompt);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const currentConversation = useMemo(() => conversations.find((item) => item.id === conversationId), [conversationId, conversations]);

  async function newConversation() {
    const response = await fetch("/api/assistant/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "New conversation" }) });
    if (!response.ok) return;
    const body = await response.json() as { data?: Conversation };
    if (body.data) {
      setConversations((current) => [body.data!, ...current]);
      setConversationId(body.data.id);
      setMessages([]);
      setLastIntent(null);
      setError("");
    }
  }

  function updateAssistant(messageId: string, update: (message: Message) => Message) {
    setMessages((current) => current.map((message) => message.id === messageId ? update(message) : message));
  }

  async function submit(valueToSend = query) {
    const trimmed = valueToSend.trim();
    if (!trimmed || loading) return;
    setQuery("");
    setLoading(true);
    setError("");
    setStatus("Preparing relevant investment context…");
    const assistantId = id();
    setMessages((current) => [...current, { id: id(), role: "user", content: trimmed, sources: [], cards: [] }, { id: assistantId, role: "assistant", content: "", sources: [], cards: [], pending: true }]);
    try {
      const response = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: trimmed, conversationId, analysisDepth }) });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? "Assistant temporarily unavailable");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = (raw: string) => {
        const chunks = raw.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: ([^\n]+)\ndata: ([\s\S]+)$/);
          if (!event) continue;
          let payload: unknown;
          try { payload = JSON.parse(event[2]); } catch { continue; }
          const data = payload as Record<string, unknown>;
          if (event[1] === "conversation" && data.conversation && typeof data.conversation === "object") {
            const next = data.conversation as Conversation;
            setConversationId(next.id);
            setConversations((current) => [next, ...current.filter((item) => item.id !== next.id)]);
          } else if (event[1] === "status") setStatus(String(data.message ?? "Analyzing…"));
          else if (event[1] === "text") updateAssistant(assistantId, (message) => ({ ...message, pending: false, content: message.content + String(data.delta ?? "") }));
          else if (event[1] === "sources") updateAssistant(assistantId, (message) => ({ ...message, sources: Array.isArray(data.sources) ? data.sources as AssistantProvenance[] : [] }));
          else if (event[1] === "cards") updateAssistant(assistantId, (message) => ({ ...message, cards: Array.isArray(data.cards) ? data.cards as Card[] : [] }));
          else if (event[1] === "done") { setStatus(""); setLastIntent(typeof data.intent === "string" ? data.intent : null); updateAssistant(assistantId, (message) => ({ ...message, pending: false })); void loadConversations(); }
          else if (event[1] === "error") { setError(String(data.message ?? "Assistant temporarily unavailable")); setStatus(""); updateAssistant(assistantId, (message) => ({ ...message, pending: false, content: String(data.message ?? "Assistant temporarily unavailable") })); }
        }
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        consume(buffer + decoder.decode(chunk.value, { stream: true }));
      }
      if (buffer) consume(`${buffer}\n\n`);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Assistant temporarily unavailable";
      setError(message);
      updateAssistant(assistantId, (current) => ({ ...current, pending: false, content: message }));
    } finally {
      setLoading(false);
      setStatus("");
    }
  }

  return <div className="conversation-layout">
    <aside className="conversation-history panel">
      <div className="conversation-history-header"><div><div className="panel-title">Conversations</div><div className="panel-caption">Private to your account</div></div><button className="button button-small" onClick={() => void newConversation()} type="button">New</button></div>
      <div className="conversation-history-list">{conversations.length ? conversations.map((item) => <button className={`conversation-history-item ${item.id === conversationId ? "active" : ""}`} key={item.id} onClick={() => void openConversation(item.id)} type="button"><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleDateString()}</small></button>) : <p className="conversation-history-empty">Your saved conversations will appear here.</p>}</div>
    </aside>
    <section className="conversation-main">
      <div className="conversation-toolbar"><div><div className="eyebrow">Investment Assistant</div><h2>{currentConversation?.title ?? "Ask about your portfolio"}</h2></div><div className="conversation-depth"><span>Depth</span><button className={analysisDepth === "QUICK" ? "active" : ""} onClick={() => setAnalysisDepth("QUICK")} type="button">Quick</button><button className={analysisDepth === "DETAILED" ? "active" : ""} onClick={() => setAnalysisDepth("DETAILED")} type="button">Detailed</button></div></div>
      <div className="conversation-messages" aria-live="polite">{messages.length ? messages.map((message) => <article className={`conversation-message ${message.role}`} key={message.id}><div className="conversation-message-label">{message.role === "user" ? "You" : "Investment Assistant"}</div><div className="conversation-message-content">{message.pending && !message.content ? <span className="conversation-typing">{status || "Analyzing…"}</span> : message.content}</div>{message.cards.length ? <div className="conversation-card-list">{message.cards.map((card, index) => <CardView card={card} key={`${card.type}-${index}`} />)}</div> : null}{message.sources.length ? <details className="conversation-sources"><summary>Sources ({message.sources.length})</summary><div>{message.sources.map((source, index) => <span key={`${source.source}-${index}`} title={`${source.source} · ${source.asOfDate ?? "current"} · retrieved ${source.retrievedAt}`}>{sourceLabel(source)}{source.asOfDate ? ` · ${source.asOfDate}` : ""}</span>)}</div></details> : null}</article>) : <div className="conversation-empty"><div className="empty-icon">✦</div><div className="empty-title">Ask about your portfolio</div><p className="empty-copy">The assistant combines your authenticated portfolio with source-backed market data and deterministic calculations.</p><div className="conversation-suggestions">{suggestions.map((suggestion) => <button className="assistant-suggestion" key={suggestion} onClick={() => void submit(suggestion)} type="button">{suggestion}</button>)}</div></div>}</div>
      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {lastIntent ? <div className="conversation-followups"><span>Suggested follow-ups</span>{followUps(lastIntent).map((item) => <button className="button button-small" key={item} onClick={() => void submit(item)} type="button">{item}</button>)}</div> : null}
      <form className="conversation-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}><textarea aria-label="Ask your investment assistant" disabled={loading} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ask about your portfolio" value={query} /><button className="button button-primary" disabled={loading || !query.trim()} type="submit">{loading ? "Analyzing…" : "Send"}</button></form>
      <div className="conversation-disclaimer">Deterministic portfolio calculations remain the source of truth. The assistant explains available data and uncertainties; it does not guarantee returns.</div>
    </section>
  </div>;
}

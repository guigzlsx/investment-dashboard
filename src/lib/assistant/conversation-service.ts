import type { Json, Database } from "../supabase/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantIntent, AssistantProvenance } from "./types";

type AssistantClient = SupabaseClient<Database>;

export interface AssistantConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolNames: string[];
  structuredData: unknown;
  provenance: AssistantProvenance[];
  createdAt: string;
}

export interface AssistantConversationState {
  symbols: string[];
  previousIntent: AssistantIntent | null;
}

function conversation(row: Pick<Database["public"]["Tables"]["assistant_conversations"]["Row"], "id" | "title" | "created_at" | "updated_at">): AssistantConversation {
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function message(row: Pick<Database["public"]["Tables"]["assistant_messages"]["Row"], "id" | "role" | "content" | "tool_names" | "structured_data" | "provenance" | "created_at">): AssistantMessage {
  return {
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    toolNames: asStringArray(row.tool_names),
    structuredData: row.structured_data,
    provenance: Array.isArray(row.provenance) ? row.provenance as unknown as AssistantProvenance[] : [],
    createdAt: row.created_at,
  };
}

export async function listAssistantConversations(supabase: AssistantClient, userId: string) {
  const result = await supabase.from("assistant_conversations").select("id, title, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30);
  if (result.error) throw result.error;
  return (result.data ?? []).map(conversation);
}

export async function createAssistantConversation(supabase: AssistantClient, userId: string, title = "New conversation") {
  const result = await supabase.from("assistant_conversations").insert({ user_id: userId, title: title.slice(0, 80) || "New conversation" }).select("id, title, created_at, updated_at").single();
  if (result.error) throw result.error;
  return conversation(result.data);
}

export async function getAssistantConversation(supabase: AssistantClient, userId: string, conversationId: string) {
  const result = await supabase.from("assistant_conversations").select("id, title, created_at, updated_at").eq("id", conversationId).eq("user_id", userId).maybeSingle();
  if (result.error) throw result.error;
  return result.data ? conversation(result.data) : null;
}

export async function updateAssistantConversationTitle(supabase: AssistantClient, userId: string, conversationId: string, title: string) {
  const result = await supabase.from("assistant_conversations").update({ title: title.trim().slice(0, 80) || "New conversation" }).eq("id", conversationId).eq("user_id", userId).select("id, title, created_at, updated_at").single();
  if (result.error) throw result.error;
  return conversation(result.data);
}

export async function listAssistantMessages(supabase: AssistantClient, userId: string, conversationId: string, limit = 24) {
  const result = await supabase.from("assistant_messages").select("id, role, content, tool_names, structured_data, provenance, created_at").eq("conversation_id", conversationId).eq("user_id", userId).order("created_at", { ascending: true }).limit(limit);
  if (result.error) throw result.error;
  return (result.data ?? []).map(message);
}

export async function appendAssistantMessage(supabase: AssistantClient, userId: string, conversationId: string, input: { role: "user" | "assistant"; content: string; toolNames?: string[]; structuredData?: unknown; provenance?: AssistantProvenance[] }) {
  const result = await supabase.from("assistant_messages").insert({ conversation_id: conversationId, user_id: userId, role: input.role, content: input.content, tool_names: (input.toolNames ?? []) as Json, structured_data: (input.structuredData ?? null) as Json | null, provenance: (input.provenance ?? []) as unknown as Json }).select("id, role, content, tool_names, structured_data, provenance, created_at").single();
  if (result.error) throw result.error;
  await supabase.from("assistant_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", userId);
  return message(result.data);
}

export function conversationStateFromMessages(messages: AssistantMessage[]): AssistantConversationState {
  for (const item of [...messages].reverse()) {
    if (!item.structuredData || typeof item.structuredData !== "object" || Array.isArray(item.structuredData)) continue;
    const state = (item.structuredData as { conversationState?: unknown }).conversationState;
    if (!state || typeof state !== "object" || Array.isArray(state)) continue;
    const typed = state as { symbols?: unknown; previousIntent?: unknown };
    return { symbols: asStringArray(typed.symbols).map((symbol) => symbol.toUpperCase()).slice(0, 8), previousIntent: typeof typed.previousIntent === "string" ? typed.previousIntent as AssistantIntent : null };
  }
  return { symbols: [], previousIntent: null };
}

export function makeConversationState(previous: AssistantConversationState, symbols: string[], intent: AssistantIntent): AssistantConversationState {
  return { symbols: [...new Set([...previous.symbols, ...symbols.map((symbol) => symbol.toUpperCase())])].slice(-8), previousIntent: intent };
}

import type { AssistantProvenance, AssistantToolName, ToolResult } from "../types";

export interface LLMHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface LLMToolDefinition {
  name: AssistantToolName;
  description: string;
  parameters: Record<string, unknown>;
}

export type LLMStreamEvent =
  | { type: "status"; message: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: AssistantToolName; status: "started" | "completed"; success?: boolean }
  | { type: "model"; model: string };

export interface LLMToolExecution {
  name: AssistantToolName;
  input: Record<string, unknown>;
  result: ToolResult<unknown>;
}

export interface LLMUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}

export interface LLMGenerateRequest {
  query: string;
  history: LLMHistoryItem[];
  instructions: string;
  tools: LLMToolDefinition[];
  executeTool: (name: AssistantToolName, input: Record<string, unknown>) => Promise<ToolResult<unknown>>;
  analysisDepth: "QUICK" | "DETAILED";
  onEvent?: (event: LLMStreamEvent) => void | Promise<void>;
}

export interface LLMGenerateResult {
  text: string;
  model: string;
  responseId: string | null;
  toolExecutions: LLMToolExecution[];
  provenance: AssistantProvenance[];
  usage: LLMUsage;
}

export interface LLMProvider {
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResult>;
}


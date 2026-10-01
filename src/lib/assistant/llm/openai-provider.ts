import "server-only";

import OpenAI from "openai";
import type { ResponseFunctionToolCall, ResponseInputItem, ResponseStreamEvent } from "openai/resources/responses/responses";
import { uniqueProvenance } from "../provenance";
import type { AssistantProvenance, AssistantToolName } from "../types";
import { getLLMServerConfig, LLMConfigurationError, type LLMServerConfig } from "./config";
import { toOpenAIFunctionTools } from "./tools";
import type { LLMGenerateRequest, LLMGenerateResult, LLMProvider, LLMStreamEvent, LLMToolExecution, LLMUsage } from "./types";

const TOOL_STATUS: Partial<Record<AssistantToolName, string>> = {
  getPortfolioSummary: "Analyzing portfolio…",
  getPortfolioHealth: "Checking portfolio health…",
  getPortfolioExposures: "Checking portfolio exposures…",
  getPosition: "Checking your position…",
  getAssetOverview: "Checking company overview…",
  getAssetFundamentals: "Checking financials…",
  getAssetGrowth: "Checking growth…",
  getAssetValuation: "Checking valuation…",
  getAssetRisks: "Checking structured risks…",
  compareAssets: "Comparing available metrics…",
  runAssetScenario: "Running portfolio scenario…",
  runMultiAssetScenario: "Running portfolio scenario…",
  runFxScenario: "Running FX scenario…",
  getWatchlist: "Analyzing watchlist…",
  getInvestmentThesis: "Reviewing your investment thesis…",
  getPerformanceAttribution: "Checking performance attribution…",
};

function limitedForModel(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[data truncated]";
  if (typeof value === "string") return value.length > 4_000 ? `${value.slice(0, 4_000)}… [truncated]` : value;
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => limitedForModel(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 80).map(([key, item]) => [key, limitedForModel(item, depth + 1)]));
  }
  return value;
}

function toolOutput(result: unknown) {
  return JSON.stringify(limitedForModel(result));
}

function addCall(calls: ResponseFunctionToolCall[], seen: Set<string>, value: unknown): void {
  if (!value || typeof value !== "object") return;
  const call = value as Partial<ResponseFunctionToolCall>;
  if (call.type !== "function_call" || typeof call.call_id !== "string" || typeof call.name !== "string" || typeof call.arguments !== "string") return;
  if (seen.has(call.call_id)) return;
  seen.add(call.call_id);
  calls.push(call as ResponseFunctionToolCall);
}

function usageFrom(response: { usage?: { input_tokens?: number | null; output_tokens?: number | null; total_tokens?: number | null } | null } | null): LLMUsage {
  return {
    inputTokens: response?.usage?.input_tokens ?? null,
    outputTokens: response?.usage?.output_tokens ?? null,
    totalTokens: response?.usage?.total_tokens ?? null,
  };
}

function addUsage(left: LLMUsage, right: LLMUsage): LLMUsage {
  return {
    inputTokens: left.inputTokens === null || right.inputTokens === null ? null : left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens === null || right.outputTokens === null ? null : left.outputTokens + right.outputTokens,
    totalTokens: left.totalTokens === null || right.totalTokens === null ? null : left.totalTokens + right.totalTokens,
  };
}

async function emit(onEvent: LLMGenerateRequest["onEvent"], event: LLMStreamEvent) {
  if (onEvent) await onEvent(event);
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly clientFactory: (config: LLMServerConfig) => OpenAI = (config) => new OpenAI({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 0 })) {}

  async generate(request: LLMGenerateRequest): Promise<LLMGenerateResult> {
    const config = getLLMServerConfig();
    const client = this.clientFactory(config);
    const preferredModel = request.analysisDepth === "DETAILED" ? config.detailedModel : config.quickModel;
    await emit(request.onEvent, { type: "model", model: preferredModel });
    try {
      return await this.generateWithModel(client, preferredModel, request, config.maxToolCalls, request.analysisDepth === "DETAILED" ? config.maxOutputTokensDetailed : config.maxOutputTokensQuick);
    } catch (error) {
      if (request.analysisDepth !== "DETAILED" || preferredModel === config.quickModel || error instanceof LLMConfigurationError) throw error;
      await emit(request.onEvent, { type: "status", message: "Detailed model unavailable; retrying with Quick mode…" });
      await emit(request.onEvent, { type: "model", model: config.quickModel });
      return this.generateWithModel(client, config.quickModel, request, config.maxToolCalls, config.maxOutputTokensQuick);
    }
  }

  private async generateWithModel(client: OpenAI, model: string, request: LLMGenerateRequest, maxToolCalls: number, maxOutputTokens: number): Promise<LLMGenerateResult> {
    let input: ResponseInputItem[] = [
      ...request.history.map((message) => ({ role: message.role, content: message.content } as ResponseInputItem)),
      { role: "user", content: request.query } as ResponseInputItem,
    ];
    const tools = toOpenAIFunctionTools(request.tools);
    const toolExecutions: LLMToolExecution[] = [];
    const provenance: AssistantProvenance[] = [];
    let fullText = "";
    let responseId: string | null = null;
    let totalUsage: LLMUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    for (let round = 0; round < 4; round += 1) {
      const stream = await client.responses.create({
        model,
        instructions: request.instructions,
        input,
        tools,
        tool_choice: "auto",
        max_output_tokens: maxOutputTokens,
        stream: true,
        store: false,
      });
      const calls: ResponseFunctionToolCall[] = [];
      const seenCalls = new Set<string>();
      let completedResponse: { id?: string; output?: unknown[]; usage?: { input_tokens?: number | null; output_tokens?: number | null; total_tokens?: number | null } | null } | null = null;

      for await (const event of stream) {
        const typedEvent = event as ResponseStreamEvent;
        if (typedEvent.type === "response.output_text.delta") {
          fullText += typedEvent.delta;
          await emit(request.onEvent, { type: "text", delta: typedEvent.delta });
        } else if (typedEvent.type === "response.output_item.done") {
          addCall(calls, seenCalls, typedEvent.item);
        } else if (typedEvent.type === "response.completed") {
          completedResponse = typedEvent.response;
          responseId = typedEvent.response.id;
          for (const output of typedEvent.response.output) addCall(calls, seenCalls, output);
        } else if (typedEvent.type === "error" || typedEvent.type === "response.failed") {
          throw new Error("OpenAI response generation failed");
        }
      }

      totalUsage = addUsage(totalUsage, usageFrom(completedResponse));
      if (!calls.length) {
        return { text: fullText.trim(), model, responseId, toolExecutions, provenance: uniqueProvenance(provenance), usage: totalUsage };
      }
      if (toolExecutions.length + calls.length > maxToolCalls) throw new Error("Assistant tool-call limit reached");

      const outputItems = completedResponse?.output?.length ? completedResponse.output as ResponseInputItem[] : calls as unknown as ResponseInputItem[];
      const toolOutputs: ResponseInputItem[] = [];
      for (const call of calls) {
        const toolName = call.name as AssistantToolName;
        await emit(request.onEvent, { type: "status", message: TOOL_STATUS[toolName] ?? "Checking investment data…" });
        await emit(request.onEvent, { type: "tool", name: toolName, status: "started" });
        let parsedInput: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(call.arguments) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) parsedInput = parsed as Record<string, unknown>;
        } catch {
          parsedInput = {};
        }
        const result = await request.executeTool(toolName, parsedInput);
        toolExecutions.push({ name: toolName, input: parsedInput, result });
        provenance.push(...result.provenance);
        await emit(request.onEvent, { type: "tool", name: toolName, status: "completed", success: result.success });
        toolOutputs.push({ type: "function_call_output", call_id: call.call_id, output: toolOutput(result) } as ResponseInputItem);
      }
      input = [...input, ...outputItems, ...toolOutputs];
    }
    throw new Error("Assistant tool-call rounds exceeded");
  }
}

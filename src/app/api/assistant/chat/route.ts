import { NextResponse } from "next/server";
import { appendAssistantMessage, conversationStateFromMessages, createAssistantConversation, getAssistantConversation, listAssistantMessages, updateAssistantConversationTitle } from "../../../../lib/assistant/conversation-service";
import { prepareAssistantTurn, structuredDataFromToolExecutions, toolDefinitionsForTurn } from "../../../../lib/assistant/conversation-runtime";
import { buildAssistantInstructions } from "../../../../lib/assistant/llm/instructions";
import { LLMConfigurationError } from "../../../../lib/assistant/llm/config";
import { OpenAIProvider } from "../../../../lib/assistant/llm/openai-provider";
import { guardFinancialAnswer } from "../../../../lib/assistant/llm/response-guards";
import type { LLMStreamEvent } from "../../../../lib/assistant/llm/types";
import { createAssistantToolContext, executeAssistantTool } from "../../../../lib/assistant/tools/registry";
import { queryInput } from "../../../../lib/assistant/tool-inputs";
import { errorResponse } from "../../../../lib/api/error-response";
import { ensureProfile } from "../../../../lib/profile/service";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";
import { failureResult } from "../../../../lib/assistant/tools/helpers";
import { InputValidationError, parseUuid } from "../../../../lib/validation/inputs";

function sse(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, event: string, payload: unknown) {
  controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
}

function streamHeaders() {
  return { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" };
}

function depthInput(value: unknown, fallback: "QUICK" | "DETAILED") {
  if (value === undefined || value === null || value === "") return fallback;
  if (value !== "QUICK" && value !== "DETAILED") throw new InputValidationError("analysisDepth is invalid");
  return value;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const body = await request.json() as { query?: unknown; conversationId?: unknown; analysisDepth?: unknown };
    const query = queryInput(body.query);
    const profile = await ensureProfile(supabase, user);
    const analysisDepth = depthInput(body.analysisDepth, profile.default_analysis_depth === "DETAILED" ? "DETAILED" : "QUICK");
    const requestedConversationId = body.conversationId ? parseUuid(body.conversationId, "conversationId") : null;
    let conversation = requestedConversationId ? await getAssistantConversation(supabase, user.id, requestedConversationId) : null;
    if (body.conversationId && !conversation) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Conversation not found" } }, { status: 404 });
    conversation ??= await createAssistantConversation(supabase, user.id, query.slice(0, 80));
    const previousMessages = await listAssistantMessages(supabase, user.id, conversation.id, 24);
    const state = conversationStateFromMessages(previousMessages);
    const context = createAssistantToolContext(supabase, user, { baseCurrency: profile.base_currency, analysisDepth });
    const turn = await prepareAssistantTurn(query, state, context);
    const instructions = buildAssistantInstructions({ intent: turn.detection.intent, entities: turn.entities, plan: turn.plan, preferences: { baseCurrency: profile.base_currency, analysisDepth }, educationContext: turn.instructionsContext });
    const history = previousMessages.slice(-16).map((message) => ({ role: message.role, content: message.content } as const));
    const allowed = new Set(turn.allowedToolNames);
    const provider = new OpenAIProvider();
    const encoder = new TextEncoder();

    await appendAssistantMessage(supabase, user.id, conversation.id, { role: "user", content: query });
    if (conversation.title === "New conversation") conversation = await updateAssistantConversationTitle(supabase, user.id, conversation.id, query);
    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, payload: unknown) => sse(controller, encoder, event, payload);
        const onEvent = async (event: LLMStreamEvent) => {
          if (event.type === "text") send("text", { delta: event.delta });
          else if (event.type === "model") send("status", { message: `Using ${event.model}` });
          else if (event.type === "tool") send("tool", event);
          else send("status", event);
        };
        void (async () => {
          const startedAt = Date.now();
          send("conversation", { conversation });
          send("status", { message: "Preparing relevant investment context…" });
          try {
            const generated = await provider.generate({
              query,
              history,
              instructions,
              tools: toolDefinitionsForTurn(turn),
              analysisDepth,
              onEvent,
              executeTool: async (name, input) => {
                if (!allowed.has(name)) return failureResult("TOOL_NOT_ALLOWED", "This tool was not selected for the current context");
                return executeAssistantTool(name, input, context);
              },
            });
            const structured = structuredDataFromToolExecutions(generated.toolExecutions, state, turn);
            const guardedText = guardFinancialAnswer(generated.text || "I could not produce a complete answer from the available data.", generated.toolExecutions);
            await appendAssistantMessage(supabase, user.id, conversation.id, { role: "assistant", content: guardedText, toolNames: generated.toolExecutions.map((item) => item.name), structuredData: structured.structuredData, provenance: structured.provenance });
            if (guardedText !== generated.text) send("text", { delta: `\n\nData note: some figures in the explanation could not be matched automatically to the deterministic tool results. Treat them as unverified and rely on the source-backed cards below.` });
            send("sources", { sources: structured.provenance });
            send("cards", { cards: structured.structuredData.cards });
            console.info("assistant_turn", { model: generated.model, latencyMs: Date.now() - startedAt, toolNames: generated.toolExecutions.map((item) => item.name), toolCalls: generated.toolExecutions.length, totalTokens: generated.usage.totalTokens });
            send("done", { conversationId: conversation.id, model: generated.model, intent: turn.detection.intent });
          } catch (error) {
            const message = error instanceof LLMConfigurationError ? "Assistant temporarily unavailable. Add OPENAI_API_KEY on the server to enable conversational answers." : "Assistant temporarily unavailable. The deterministic investment tools remain available.";
            send("error", { message, code: error instanceof LLMConfigurationError ? "CONFIGURATION_REQUIRED" : "LLM_UNAVAILABLE" });
          } finally {
            controller.close();
          }
        })();
      },
    });
    return new Response(responseStream, { headers: streamHeaders() });
  } catch (error) {
    return errorResponse(error);
  }
}

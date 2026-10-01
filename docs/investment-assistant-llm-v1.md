# Investment Assistant LLM v1 — Lot 4B

## Scope

Lot 4B adds a conversational explanation layer above the deterministic Lot 4A engine. The language model is never the source of truth for portfolio or market calculations. It can request the existing typed tools, receive their structured results, and explain them.

```text
User → /assistant → /api/assistant/chat
     → LLMProvider / OpenAIProvider
     → selected deterministic tools
     → portfolio and market engines
     → tool results + provenance
     → streamed natural-language answer + deterministic cards
```

Lot 4B does not add an LLM to `/api/assistant/analyze`; that endpoint remains the deterministic debug and fallback surface.

## OpenAI API choice

The implementation uses the official OpenAI JavaScript SDK and the Responses API. Responses function tools are sent with `strict: true` and closed JSON schemas. A streamed response is consumed through `response.output_text.delta`; function calls are executed server-side and returned as `function_call_output` items before the next Responses turn.

The official references used for this implementation are:

- [Responses function calling](https://developers.openai.com/api/docs/guides/function-calling);
- [Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses);
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state);
- [OpenAI models](https://developers.openai.com/api/docs/models).

The app uses its own Supabase conversation history instead of relying on `previous_response_id`. This keeps history, RLS, deletion and multi-device recovery inside the application. It also means every selected history item is intentionally bounded before being sent to the model.

## Provider abstraction and models

`LLMProvider` is the application boundary. `OpenAIProvider` is the only implemented provider. Future Anthropic, Google or local providers can implement the same interface without changing the conversation route or the tools.

Model defaults are centralized in `src/lib/assistant/llm/config.ts`:

- Quick: `gpt-5-mini`;
- Detailed: `gpt-5.1`.

Both can be changed through `OPENAI_MODEL_QUICK` and `OPENAI_MODEL_DETAILED`. Detailed mode retries once with the Quick model when the selected detailed model fails. Model IDs are defaults, not business logic.

## Tool calling and context minimization

The deterministic router, entity resolver, query planner and context selector run before the model call. They determine the intent, resolved symbols, parameters and relevant tool subset. The registry still contains all 17 Lot 4A tools, but a turn only exposes the subset selected for that context.

The server checks the authenticated Supabase user before every tool call. The model and browser cannot provide an authoritative `userId`. A tool call outside the selected subset returns a structured `TOOL_NOT_ALLOWED` result.

Tool outputs are bounded before being sent to OpenAI. Large arrays and long strings are truncated for prompt cost control, while the original deterministic result remains available to the server for cards, provenance and persistence.

## Conversation state and persistence

Two RLS-protected tables are used:

- `assistant_conversations`: one row per user-owned conversation;
- `assistant_messages`: user and assistant messages, tool names, structured cards and provenance.

The migration is `supabase/migrations/20261001110000_assistant_conversations.sql`. Messages are loaded with a bounded history window. A compact state stored with assistant messages preserves recent symbols and the previous intent, so requests such as “What about Marvell?” and “Compare them” can reuse NVDA/MRVL context without sending an unbounded transcript.

## Response and UI model

The model produces text only. It does not generate HTML or component schemas. Cards are generated deterministically from successful tool results:

- portfolio summary;
- position;
- scenario;
- comparison;
- structured risk data.

Sources are also generated from tool provenance. The UI shows source, freshness and `asOfDate` when available. Suggested follow-ups are fixed by intent and therefore cannot be fabricated by the model.

## Safety and prompt injection

The server instructions explicitly classify FMP data, ECB data, company descriptions and user notes as untrusted data. Instruction-like text inside a note cannot change the system instructions or authorization path. The model receives no service-role key and no direct database access.

The assistant is instructed to:

- use tools for calculations;
- distinguish facts from interpretation;
- disclose missing data and uncertainty;
- avoid guaranteed returns or automatic buy/sell conclusions;
- avoid inventing sources or financial values.

A lightweight numeric guard compares numbers in the final explanation with numbers present in deterministic tool results and adds a visible unverified-data note when it cannot match them. This is a safeguard, not a perfect NLP proof.

## Failure handling and cost controls

- Missing `OPENAI_API_KEY` produces a non-fatal “Assistant temporarily unavailable” state.
- The deterministic `/api/assistant/analyze` endpoint remains available.
- OpenAI calls use a timeout, no automatic SDK retries, a maximum of four tool rounds and eight tool calls per request.
- Quick and Detailed output budgets are centralized in server configuration.
- Server logs record model, latency, tool names, tool-call count and token count only; prompts, keys and full portfolio values are not logged.

## Environment

Add the following server-only variables locally or in deployment. Never prefix the key with `NEXT_PUBLIC_`:

```text
OPENAI_API_KEY=
OPENAI_MODEL_QUICK=gpt-5-mini
OPENAI_MODEL_DETAILED=gpt-5.1
```

The Profile `default_analysis_depth` is used as the initial assistant depth. The Quick/Detailed control in `/assistant` is turn-local and does not update Profile unless a future explicit profile action is added.

## Limitations

- Education answers are model-generated from a small deterministic reference context; they are explanatory, not investment advice.
- No automatic investment recommendation, execution, alerts or trading action is implemented.
- The assistant requires an OpenAI key for conversational answers; without it, Lot 4A remains usable.
- The numeric guard cannot prove every natural-language number and intentionally surfaces uncertainty rather than rewriting the model's answer.
- OpenAI availability, model access and pricing depend on the account and deployment configuration.


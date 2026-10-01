import "server-only";

export const DEFAULT_QUICK_MODEL = "gpt-5-mini";
export const DEFAULT_DETAILED_MODEL = "gpt-5.1";

export interface LLMServerConfig {
  apiKey: string;
  quickModel: string;
  detailedModel: string;
  timeoutMs: number;
  maxToolCalls: number;
  maxOutputTokensQuick: number;
  maxOutputTokensDetailed: number;
}

export class LLMConfigurationError extends Error {
  constructor(message = "The conversational assistant is not configured") {
    super(message);
    this.name = "LLMConfigurationError";
  }
}

export function getLLMServerConfig(): LLMServerConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new LLMConfigurationError("OPENAI_API_KEY is missing");
  return {
    apiKey,
    quickModel: process.env.OPENAI_MODEL_QUICK?.trim() || DEFAULT_QUICK_MODEL,
    detailedModel: process.env.OPENAI_MODEL_DETAILED?.trim() || DEFAULT_DETAILED_MODEL,
    timeoutMs: 35_000,
    maxToolCalls: 8,
    maxOutputTokensQuick: 900,
    maxOutputTokensDetailed: 1_600,
  };
}


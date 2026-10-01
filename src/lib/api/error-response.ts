import { NextResponse } from "next/server";
import { ConfigurationError } from "../config/env";
import { MarketDataProviderError } from "../market-data/errors";
import { AuthenticationRequiredError } from "../supabase/auth";
import { InputValidationError } from "../validation/inputs";
import { LLMConfigurationError } from "../assistant/llm/config";

export function errorResponse(error: unknown) {
  if (error instanceof InputValidationError) return NextResponse.json({ error: { code: "INVALID_INPUT", message: error.message } }, { status: 400 });
  if (error instanceof ConfigurationError) return NextResponse.json({ error: { code: "CONFIGURATION_REQUIRED", message: error.message } }, { status: 503 });
  if (error instanceof LLMConfigurationError) return NextResponse.json({ error: { code: "CONFIGURATION_REQUIRED", message: "The conversational assistant is temporarily unavailable." } }, { status: 503 });
  if (error instanceof AuthenticationRequiredError) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: error.message } }, { status: 401 });
  if (error instanceof MarketDataProviderError) {
    const status = error.code === "RATE_LIMIT" ? 429 : error.code === "NOT_FOUND" ? 404 : error.code === "AUTHENTICATION" ? 502 : 503;
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }, { status: 500 });
}

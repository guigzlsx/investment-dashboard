import type { LLMToolExecution } from "./types";

function numericTokens(value: string) {
  return (value.match(/-?\d+(?:[.,]\d+)?/g) ?? []).map((token) => Number(token.replace(",", "."))).filter((token) => Number.isFinite(token));
}

export function guardFinancialAnswer(text: string, executions: LLMToolExecution[]) {
  if (!executions.length) return text;
  const available = new Set(executions.flatMap((execution) => numericTokens(JSON.stringify(execution.result.data ?? {}))).map((number) => number.toFixed(6)));
  const unsupported = numericTokens(text).filter((number) => number >= 1900 && number <= 2200 ? false : !available.has(number.toFixed(6)));
  if (!unsupported.length) return text;
  return `${text.trim()}\n\nData note: some figures in the explanation could not be matched automatically to the deterministic tool results. Treat them as unverified and rely on the source-backed cards below.`;
}


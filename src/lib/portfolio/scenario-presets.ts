import type { PositionSummary } from "./types";

export const SCENARIO_PRESETS = [
  { key: "tech-correction", label: "Tech correction", description: "Shock positions classified as Technology by -25%.", shock: -0.25, matcher: (position: PositionSummary) => position.sector === "Technology" },
  { key: "ai-correction", label: "AI correction", description: "Shock positions explicitly classified with an AI theme by -25%.", shock: -0.25, matcher: (position: PositionSummary) => Boolean(position.themes?.some((theme) => theme.toLowerCase().includes("ai"))) },
  { key: "market-correction", label: "Market correction", description: "Shock every classified position by -15%.", shock: -0.15, matcher: () => true },
  { key: "usd-weakness", label: "USD weakness", description: "Apply a -10% USD/EUR FX shock without changing asset prices in USD.", shock: -0.1, matcher: () => false },
] as const;

import { InputValidationError } from "../validation/inputs";

export const PROFILE_CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
export type ProfileCurrency = (typeof PROFILE_CURRENCIES)[number];

export const ANALYSIS_DEPTHS = ["QUICK", "DETAILED"] as const;
export type AnalysisDepth = (typeof ANALYSIS_DEPTHS)[number];

export interface ProfileUpdateInput {
  displayName?: string | null;
  baseCurrency?: ProfileCurrency;
  defaultAnalysisDepth?: AnalysisDepth;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseProfileUpdate(value: unknown): ProfileUpdateInput {
  if (!isRecord(value)) throw new InputValidationError("Profile update must be an object");
  const update: ProfileUpdateInput = {};

  if ("displayName" in value) {
    if (value.displayName !== null && typeof value.displayName !== "string") throw new InputValidationError("Display name is invalid");
    const displayName = typeof value.displayName === "string" ? value.displayName.trim() : null;
    if (displayName && displayName.length > 80) throw new InputValidationError("Display name is too long");
    update.displayName = displayName || null;
  }

  if ("baseCurrency" in value) {
    if (typeof value.baseCurrency !== "string" || !PROFILE_CURRENCIES.includes(value.baseCurrency as ProfileCurrency)) throw new InputValidationError("Base currency is invalid");
    update.baseCurrency = value.baseCurrency as ProfileCurrency;
  }

  if ("defaultAnalysisDepth" in value) {
    if (typeof value.defaultAnalysisDepth !== "string" || !ANALYSIS_DEPTHS.includes(value.defaultAnalysisDepth as AnalysisDepth)) throw new InputValidationError("Analysis depth is invalid");
    update.defaultAnalysisDepth = value.defaultAnalysisDepth as AnalysisDepth;
  }

  if (!Object.keys(update).length) throw new InputValidationError("No profile changes were provided");
  return update;
}

export function displayNameForUser(displayName: string | null | undefined, email: string | null | undefined) {
  return displayName?.trim() || email?.split("@")[0] || "Account";
}

export function initialsForUser(displayName: string | null | undefined, email: string | null | undefined) {
  const value = displayNameForUser(displayName, email).trim();
  const words = value.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[words.length - 1][0]}` : value.slice(0, 2)).toUpperCase();
}

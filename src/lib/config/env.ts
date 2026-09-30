export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function getFmpApiKey() {
  const apiKey = process.env.FMP_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigurationError("FMP_API_KEY is not configured");
  }
  return apiKey;
}

export function getFmpDataKind() {
  const value = process.env.FMP_DATA_KIND?.trim().toUpperCase();
  if (value === "REALTIME" || value === "DELAYED" || value === "EOD") {
    return value;
  }
  return "UNKNOWN" as const;
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  if (!url || !key) {
    throw new ConfigurationError("Supabase environment variables are not configured");
  }
  return { url, key };
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new ConfigurationError("SUPABASE_SERVICE_ROLE_KEY is not configured for server-side asset writes");
  return key;
}

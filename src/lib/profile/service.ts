import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../supabase/database.types";
import type { ProfileUpdateInput } from "../auth/profile";

type TypedSupabaseClient = SupabaseClient<Database>;
export type ProfileRecord = Database["public"]["Tables"]["profiles"]["Row"];

const PROFILE_COLUMNS = "id, display_name, base_currency, default_analysis_depth, created_at, updated_at";

export async function ensureProfile(supabase: TypedSupabaseClient, user: User): Promise<ProfileRecord> {
  const existing = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase.from("profiles").insert({ id: user.id }).select(PROFILE_COLUMNS).single();
  if (!created.error) return created.data;
  if (created.error.code !== "23505") throw created.error;

  const concurrent = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).single();
  if (concurrent.error) throw concurrent.error;
  return concurrent.data;
}

export async function updateProfile(supabase: TypedSupabaseClient, userId: string, updates: ProfileUpdateInput): Promise<ProfileRecord> {
  const result = await supabase.from("profiles").update({
    ...(updates.displayName !== undefined ? { display_name: updates.displayName } : {}),
    ...(updates.baseCurrency !== undefined ? { base_currency: updates.baseCurrency } : {}),
    ...(updates.defaultAnalysisDepth !== undefined ? { default_analysis_depth: updates.defaultAnalysisDepth } : {}),
  }).eq("id", userId).select(PROFILE_COLUMNS).single();
  if (result.error) throw result.error;
  return result.data;
}

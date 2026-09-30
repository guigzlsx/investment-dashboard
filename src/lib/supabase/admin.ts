import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig, getSupabaseServiceRoleKey } from "../config/env";
import type { Database } from "./database.types";

export function createSupabaseAdminClient() {
  const { url } = getSupabaseConfig();
  return createClient<Database>(url, getSupabaseServiceRoleKey(), { auth: { autoRefreshToken: false, persistSession: false } });
}

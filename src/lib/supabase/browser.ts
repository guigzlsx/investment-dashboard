"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "../config/env";
import type { Database } from "./database.types";

export function createSupabaseBrowserClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient<Database>(url, key);
}

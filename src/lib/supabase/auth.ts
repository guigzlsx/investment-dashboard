import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./server";
import type { Database } from "./database.types";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required for personal portfolio data");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAuthenticatedSupabase(): Promise<{ supabase: SupabaseClient<Database>; user: User }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new AuthenticationRequiredError();
  return { supabase, user: data.user };
}

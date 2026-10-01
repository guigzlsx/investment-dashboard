import { NextResponse } from "next/server";
import { errorResponse } from "../../../lib/api/error-response";
import { parseProfileUpdate } from "../../../lib/auth/profile";
import { ensureProfile, updateProfile } from "../../../lib/profile/service";
import { getAuthenticatedSupabase } from "../../../lib/supabase/auth";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const profile = await ensureProfile(supabase, user);
    return NextResponse.json({ data: { ...profile, email: user.email ?? null } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const updates = parseProfileUpdate(await request.json());
    await ensureProfile(supabase, user);
    const profile = await updateProfile(supabase, user.id, updates);
    return NextResponse.json({ data: { ...profile, email: user.email ?? null } });
  } catch (error) {
    return errorResponse(error);
  }
}

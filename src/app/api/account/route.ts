import { NextResponse } from "next/server";
import { errorResponse } from "../../../lib/api/error-response";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import { getAuthenticatedSupabase } from "../../../lib/supabase/auth";

export async function DELETE() {
  try {
    const { user } = await getAuthenticatedSupabase();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    return errorResponse(error);
  }
}

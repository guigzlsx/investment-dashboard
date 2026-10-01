import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import { parseUuid } from "../../../../../lib/validation/inputs";

export async function POST(request: Request) {
  try {
    const { supabase } = await getAuthenticatedSupabase();
    const body = await request.json() as { importId?: unknown; skipDuplicates?: unknown };
    const importId = parseUuid(body.importId, "importId");
    const skipDuplicates = body.skipDuplicates !== false;
    const result = await supabase.rpc("commit_portfolio_import", { p_import_id: importId, p_skip_duplicates: skipDuplicates });
    if (result.error) throw result.error;
    return NextResponse.json({ data: result.data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("IMPORT_NOT_READY")) return NextResponse.json({ error: { code: "IMPORT_NOT_READY", message: "Resolve import errors before confirming." } }, { status: 400 });
    if (message.includes("IMPORT_NOT_FOUND")) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Import session not found." } }, { status: 404 });
    return errorResponse(error);
  }
}

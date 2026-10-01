import { NextResponse } from "next/server";
import { errorResponse } from "../../../../../lib/api/error-response";
import { buildPortfolioImportPreview, importErrorMessage } from "../../../../../lib/portfolio-import/service";
import { MAX_FILE_BYTES } from "../../../../../lib/portfolio-import/parser";
import { getAuthenticatedSupabase } from "../../../../../lib/supabase/auth";
import type { ImportColumnMapping } from "../../../../../lib/portfolio-import/types";
import { parseUuid } from "../../../../../lib/validation/inputs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Please choose a CSV or XLSX file." } }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: { code: "IMPORT_INVALID", message: importErrorMessage(new Error("file_too_large")) } }, { status: 400 });
    const importIdValue = form.get("importId");
    const mappingValue = form.get("mapping");
    const selectionsValue = form.get("selections");
    let mapping: ImportColumnMapping | undefined;
    let selections: Record<string, string> | undefined;
    try { mapping = mappingValue ? JSON.parse(String(mappingValue)) as ImportColumnMapping : undefined; } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Column mapping is invalid." } }, { status: 400 }); }
    try { selections = selectionsValue ? JSON.parse(String(selectionsValue)) as Record<string, string> : undefined; } catch { return NextResponse.json({ error: { code: "INVALID_INPUT", message: "Asset selections are invalid." } }, { status: 400 }); }
    const preview = await buildPortfolioImportPreview(supabase, user, { fileName: file.name, buffer: Buffer.from(await file.arrayBuffer()), importId: importIdValue ? parseUuid(String(importIdValue), "importId") : undefined, sheetName: form.get("sheet") ? String(form.get("sheet")) : undefined, mapping, selections });
    return NextResponse.json({ data: preview });
  } catch (error) {
    const message = error instanceof Error && ["file_too_large", "unsupported_file_type", "empty_file", "malformed_file", "duplicate_mapping"].includes(error.message) ? importErrorMessage(error) : null;
    if (message) return NextResponse.json({ error: { code: "IMPORT_INVALID", message } }, { status: 400 });
    return errorResponse(error);
  }
}

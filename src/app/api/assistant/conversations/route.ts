import { NextResponse } from "next/server";
import { createAssistantConversation, listAssistantConversations, listAssistantMessages } from "../../../../lib/assistant/conversation-service";
import { errorResponse } from "../../../../lib/api/error-response";
import { parseUuid } from "../../../../lib/validation/inputs";
import { getAuthenticatedSupabase } from "../../../../lib/supabase/auth";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const conversationId = new URL(request.url).searchParams.get("conversationId");
    if (!conversationId) return NextResponse.json({ data: await listAssistantConversations(supabase, user.id) });
    const id = parseUuid(conversationId, "conversationId");
    const messages = await listAssistantMessages(supabase, user.id, id, 40);
    return NextResponse.json({ data: messages });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedSupabase();
    const body = await request.json().catch(() => ({})) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title : "New conversation";
    return NextResponse.json({ data: await createAssistantConversation(supabase, user.id, title) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}


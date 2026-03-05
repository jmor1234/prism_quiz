// app/api/admin/chats/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listChatSessions } from "@/server/chatSessions";

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json({ error: "Admin access not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const providedKey = searchParams.get("key");

  if (!providedKey || providedKey !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;
    const cursor = searchParams.get("cursor") ?? undefined;

    const { sessions, nextCursor } = await listChatSessions(limit, cursor);

    // Filter to only sessions that have conversations
    const withConversations = sessions.filter(
      (s) => s.conversation && s.conversation.length > 0
    );

    return NextResponse.json({ sessions: withConversations, nextCursor });
  } catch (error) {
    console.error("[Admin Chats] Error:", error);
    return NextResponse.json({ error: "Failed to fetch chat sessions" }, { status: 500 });
  }
}

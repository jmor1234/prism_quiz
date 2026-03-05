// app/api/chat/engagement/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  saveChatConversation,
  appendChatEvent,
} from "@/server/chatSessions";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { threadId, event, conversation } = body as {
      threadId?: string;
      event?: { type: string; source: string };
      conversation?: { role: "user" | "assistant"; text: string }[];
    };

    if (!threadId || typeof threadId !== "string") {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    if (event) {
      await appendChatEvent(threadId, event);
    }

    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      await saveChatConversation(threadId, conversation);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Chat Engagement] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

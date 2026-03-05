// app/api/quiz/engagement/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  appendEvent,
  saveEngagementConversation,
} from "@/server/quizEngagement";
import type { SerializedMessage } from "@/server/quizEngagement";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizId, event, conversation } = body as {
      quizId?: string;
      event?: { type: string; source: string };
      conversation?: SerializedMessage[];
    };

    if (!quizId || typeof quizId !== "string") {
      return NextResponse.json({ error: "quizId required" }, { status: 400 });
    }

    if (event) {
      await appendEvent(quizId, event);
    }

    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      await saveEngagementConversation(quizId, conversation);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Engagement API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

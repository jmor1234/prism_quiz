// app/api/bestlife/engagement/route.ts
//
// Engagement tracking for the best-life-care quiz variant. Mirrors
// /api/quiz/engagement but writes to the isolated bestlife-engagement
// storage namespace.

import { NextRequest, NextResponse } from "next/server";
import {
  appendBestLifeEvent,
  saveBestLifeConversation,
} from "@/server/bestLifeEngagement";
import type { SerializedMessage } from "@/server/bestLifeEngagement";

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
      await appendBestLifeEvent(quizId, event);
    }

    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      await saveBestLifeConversation(quizId, conversation);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[BestLife Engagement] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

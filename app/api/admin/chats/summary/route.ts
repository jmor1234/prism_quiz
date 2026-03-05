// app/api/admin/chats/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getChatSession, saveChatSummary } from "@/server/chatSessions";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "Admin access not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { threadId, key } = body as { threadId?: string; key?: string };

    if (!key || key !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!threadId || typeof threadId !== "string") {
      return NextResponse.json(
        { error: "threadId required" },
        { status: 400 }
      );
    }

    const session = await getChatSession(threadId);

    if (!session?.conversation || session.conversation.length === 0) {
      return NextResponse.json(
        { error: "No conversation to summarize" },
        { status: 400 }
      );
    }

    const conversationText = session.conversation
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`)
      .join("\n\n");

    const { text: summary } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: `You are an internal analyst for Prism Health, a bioenergetic health practice focused on cellular energy production and metabolic function. Prism helps people resolve health issues and optimize performance through a data-driven, root-cause approach. You are summarizing a standalone conversation (no quiz was taken) for the admin team.

Context: This person interacted directly with Prism's AI health agent without taking a quiz first. They likely found Prism through social media content. The agent's purpose was to understand their health situation from scratch, provide valuable research-backed insights through a bioenergetic lens, and build enough understanding that booking a consultation feels like the natural next step. Prism's consultation is a free intro call that leads into a team-based, data-driven process involving comprehensive questionnaires, physiological measurements, and expert review.

Your summary should be concise (3-8 sentences) and capture:
- The main health concerns discussed and how they connect
- Key patterns or root-cause insights the agent surfaced
- The person's level of engagement and understanding (skeptical, curious, deeply engaged, ready to act)
- Whether they expressed interest in next steps, booking, or going deeper
- Any signals relevant to whether this person is a good fit for Prism's process

Write in plain prose, not bullet points. Be direct and factual. This is an internal document for the team to quickly assess each prospect's conversation.`,
      prompt: `Conversation transcript (${session.conversation.length} messages):\n${conversationText}`,
    });

    await saveChatSummary(threadId, summary);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[Admin Chat Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

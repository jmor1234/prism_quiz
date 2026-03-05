// app/api/admin/results/summary/route.ts

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getQuizSubmission } from "@/server/quizSubmissions";
import { getQuizResult } from "@/server/quizResults";
import {
  getEngagement,
  saveEngagementSummary,
} from "@/server/quizEngagement";
import { getVariant } from "@/lib/quiz/variants";
import { formatAnswers } from "@/lib/quiz/formatAnswers";

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
    const { quizId, key } = body as { quizId?: string; key?: string };

    if (!key || key !== adminPassword) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!quizId || typeof quizId !== "string") {
      return NextResponse.json(
        { error: "quizId required" },
        { status: 400 }
      );
    }

    // Fetch all context in parallel
    const [submission, result, engagement] = await Promise.all([
      getQuizSubmission(quizId),
      getQuizResult(quizId),
      getEngagement(quizId),
    ]);

    if (!engagement?.conversation || engagement.conversation.length === 0) {
      return NextResponse.json(
        { error: "No conversation to summarize" },
        { status: 400 }
      );
    }

    // Build context for the summary agent
    const variant = submission ? getVariant(submission.variant) : null;
    const formattedAnswers =
      variant && submission
        ? formatAnswers(variant, submission.name, submission.answers)
        : null;

    const conversationText = engagement.conversation
      .map((m) => `${m.role === "user" ? "User" : "Agent"}: ${m.text}`)
      .join("\n\n");

    const { text: summary } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: `You are an internal analyst for Prism Health, a bioenergetic health practice focused on cellular energy production and metabolic function. Prism helps people resolve health issues and optimize performance through a data-driven, root-cause approach. You are summarizing a conversation for the admin team.

Context: People who reach Prism range from those with unresolved health issues (often failed by conventional medicine and alternative approaches) to data-driven optimizers who want to perform better. Many found Prism through social media content. They found Prism through social media content and took a health quiz that generated a personalized assessment. After reading their assessment, they chose to continue into a conversation with Prism's AI health agent. The agent's purpose was to deepen their understanding of their health patterns, ground insights in real research, and build enough understanding that booking a consultation feels like the natural next step. Prism's consultation is a free intro call that leads into a team-based, data-driven process involving comprehensive questionnaires, physiological measurements, and expert review.

Your summary should be concise (3-8 sentences) and capture:
- The main health concerns discussed and how they connect
- Key patterns or root-cause insights the agent surfaced
- The person's level of engagement and understanding (skeptical, curious, deeply engaged, ready to act)
- Whether they expressed interest in next steps, booking, or going deeper
- Any signals relevant to whether this person is a good fit for Prism's process

Write in plain prose, not bullet points. Be direct and factual. This is an internal document for the team to quickly assess each prospect's conversation.`,
      prompt: `${submission ? `Quiz variant: ${variant?.name ?? submission.variant}\nClient name: ${submission.name}\n` : ""}${formattedAnswers ? `\nQuiz answers:\n${formattedAnswers}\n` : ""}${result ? `\nAssessment the user received:\n${result.report}\n` : ""}\nConversation transcript (${engagement.conversation.length} messages):\n${conversationText}`,
    });

    await saveEngagementSummary(quizId, summary);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("[Admin Summary] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

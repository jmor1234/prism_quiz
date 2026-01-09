// app/api/quiz/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { quizSubmissionSchema, type QuizSubmission } from "@/lib/schemas/quiz";
import { upsertQuizSubmission } from "@/server/quizSubmissions";
import { saveQuizResult } from "@/server/quizResults";
import { buildQuizSystemPrompt } from "./systemPrompt";

// 60 seconds max - quiz should be fast
export const maxDuration = 60;

export async function POST(req: Request) {
  let submission: QuizSubmission;

  // Parse and validate request body
  try {
    const body = await req.json();
    const parsed = quizSubmissionSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid submission",
          details: parsed.error.flatten(),
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    submission = parsed.data;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Save submission
    const record = await upsertQuizSubmission({ submission });
    console.log(`[Quiz] Submission saved: ${record.id}`);

    // 2. Build system prompt with knowledge + answers
    const messages = await buildQuizSystemPrompt(submission);

    // 3. Generate report
    console.log(`[Quiz] Starting generation for: ${record.id}`);

    const result = await generateText({
      model: anthropic("claude-opus-4-5-20251101"),
      messages,
      providerOptions: {
        anthropic: {
          max_tokens: 2000,
        },
      },
    });

    console.log(`[Quiz] Generation complete for: ${record.id}`);

    // 4. Save result
    await saveQuizResult({
      id: record.id,
      report: result.text,
    });

    console.log(`[Quiz] Result saved for: ${record.id}`);

    // 5. Return response
    return new Response(
      JSON.stringify({
        id: record.id,
        report: result.text,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Quiz] Generation failed:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during generation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

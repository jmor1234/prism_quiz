// app/api/quiz/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

import { quizSubmissionSchema, type QuizSubmission } from "@/lib/schemas/quiz";
import { upsertQuizSubmission, getQuizSubmission } from "@/server/quizSubmissions";
import { saveQuizResult, getQuizResult } from "@/server/quizResults";
import { buildQuizSystemPrompt } from "./systemPrompt";

// 60 seconds max - quiz should be fast
export const maxDuration = 60;

export async function POST(req: Request) {
  let submission: QuizSubmission;
  let recordId: string | undefined;

  // Parse request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for retry case (submissionId provided)
  const existingSubmissionId =
    typeof body.submissionId === "string" ? body.submissionId : undefined;

  try {
    if (existingSubmissionId) {
      // Retry case: use stored submission data
      const existing = await getQuizSubmission(existingSubmissionId);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Submission not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if result already exists (avoid re-generation)
      const existingResult = await getQuizResult(existingSubmissionId);
      if (existingResult) {
        console.log(`[Quiz] Returning existing result for: ${existingSubmissionId}`);
        return new Response(
          JSON.stringify({
            id: existingSubmissionId,
            report: existingResult.report,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Use stored submission data for generation
      submission = existing.submission;
      recordId = existingSubmissionId;
      console.log(`[Quiz] Retrying generation for existing submission: ${recordId}`);
    } else {
      // New submission: validate request body
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

      // Save new submission
      const record = await upsertQuizSubmission({ submission });
      recordId = record.id;
      console.log(`[Quiz] New submission saved: ${recordId}`);
    }

    // 2. Build system prompt with knowledge + answers
    const messages = await buildQuizSystemPrompt(submission);

    // 3. Generate report
    console.log(`[Quiz] Starting generation for: ${recordId}`);

    const result = await generateText({
      model: anthropic("claude-opus-4-6"),
      messages,
    });

    console.log(`[Quiz] Generation complete for: ${recordId}`);

    // 4. Save result
    await saveQuizResult({
      id: recordId,
      report: result.text,
    });

    console.log(`[Quiz] Result saved for: ${recordId}`);

    // 5. Return response
    return new Response(
      JSON.stringify({
        id: recordId,
        report: result.text,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[Quiz] Generation failed:", error);

    // Return submission ID if available (for retry)
    const returnId = recordId ?? existingSubmissionId;

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during generation",
        ...(returnId && { submissionId: returnId }),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

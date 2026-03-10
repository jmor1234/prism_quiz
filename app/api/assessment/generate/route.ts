// app/api/assessment/generate/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { assessmentTools } from "./tools";
import { buildAssessmentPrompt } from "./prompt";
import {
  saveAssessmentResult,
  getAssessmentResult,
} from "@/server/assessmentResults";
import { requestRateLimiter, extractIp } from "@/app/api/agent/lib/rateLimit";
import { z } from "zod";

export const maxDuration = 120;

const inputSchema = z.object({
  name: z.string().optional(),
  steps: z
    .array(
      z.object({
        question: z.string(),
        selectedOptions: z.array(z.string()),
        freeText: z.string(),
      })
    )
    .min(1, "At least one intake step is required"),
  resultId: z.string().optional(),
});

export async function POST(req: Request) {
  // Rate limiting
  const ip = extractIp(req);
  const rateCheck = requestRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    console.log(
      `[Assessment] Rate limited: ${ip} (retry after ${rateCheck.retryAfterSeconds}s)`
    );
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again shortly." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfterSeconds ?? 60),
        },
      }
    );
  }

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

  // Validate input
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid input",
        details: parsed.error.flatten(),
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { name, steps, resultId } = parsed.data;

  try {
    // Retry case: check for existing result
    if (resultId) {
      const existing = await getAssessmentResult(resultId);
      if (existing) {
        console.log(
          `[Assessment] Returning existing result for: ${resultId}`
        );
        return new Response(
          JSON.stringify({ id: resultId, report: existing.report }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Build prompt
    const { system, userMessage } = await buildAssessmentPrompt(name, steps);

    // Generate assessment with evidence tools
    const recordId = resultId ?? crypto.randomUUID();
    console.log(`[Assessment] Starting generation: ${recordId}`);
    const genStart = Date.now();

    const result = await generateText({
      model: anthropic("claude-opus-4-6"),
      system,
      messages: [{ role: "user" as const, content: userMessage }],
      tools: assessmentTools,
      stopWhen: stepCountIs(5),
      providerOptions: {
        anthropic: {
          thinking: { type: "adaptive" },
          effort: "low",
          contextManagement: {
            edits: [
              {
                type: "clear_thinking_20251015",
                keep: "all",
              },
            ],
          },
        },
      },
    });

    // Log tool usage summary
    const genMs = Date.now() - genStart;
    const toolCounts: Record<string, number> = {};
    let totalToolTokens = 0;
    for (const step of result.steps) {
      for (const tc of step.toolCalls) {
        toolCounts[tc.toolName] = (toolCounts[tc.toolName] ?? 0) + 1;
      }
      for (const tr of step.toolResults) {
        totalToolTokens += Math.round(JSON.stringify(tr).length / 4);
      }
    }
    const toolSummary = Object.entries(toolCounts)
      .map(([name, count]) => `${count} ${name}`)
      .join(" + ");
    console.log(
      `[Assessment] Complete: ${recordId} · ${toolSummary || "no tools"} · ~${totalToolTokens} tok to agent · ${result.steps.length} steps`
    );
    console.log(
      `[Assessment] Tokens: in: ${result.usage.inputTokens} · out: ${result.usage.outputTokens} · ${(genMs / 1000).toFixed(1)}s`
    );

    // Save result
    await saveAssessmentResult({
      id: recordId,
      report: result.text,
    });

    console.log(`[Assessment] Result saved: ${recordId}`);

    return new Response(
      JSON.stringify({ id: recordId, report: result.text }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Assessment] Generation failed:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during generation",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

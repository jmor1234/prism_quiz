// app/api/quiz/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import { quizTools } from "./tools";

import { getVariant } from "@/lib/quiz/variants";
import { buildSubmissionSchema } from "@/lib/quiz/schema";
import { upsertQuizSubmission, getQuizSubmission } from "@/server/quizSubmissions";
import { saveQuizResult, getQuizResult } from "@/server/quizResults";
import { buildQuizPrompt } from "./systemPrompt";
import { requestRateLimiter, extractIp } from "../agent/lib/rateLimit";
import { CacheManager } from "../agent/lib/cacheManager";

// 120 seconds — tool calls (evidence retrieval) add latency
export const maxDuration = 120;

// Three-tier prompt caching: tools, system prompt, conversation history
const cacheManager = new CacheManager();
const cachedTools = cacheManager.prepareCachedTools(quizTools);

// Opus 4.6 pricing (per token)
const PRICE_INPUT = 5 / 1_000_000;
const PRICE_WRITE = 6.25 / 1_000_000;
const PRICE_READ = 0.5 / 1_000_000;
const PRICE_OUTPUT = 25 / 1_000_000;

export async function POST(req: Request) {
  // Rate limiting
  const ip = extractIp(req);
  const rateCheck = requestRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    console.log(
      `[Quiz] Rate limited: ${ip} (retry after ${rateCheck.retryAfterSeconds}s)`
    );
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again shortly.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfterSeconds ?? 60),
        },
      }
    );
  }

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
    let variant: string;
    let name: string;
    let answers: Record<string, unknown>;

    if (existingSubmissionId) {
      // Retry case: fetch submission and result in parallel
      const [existing, existingResult] = await Promise.all([
        getQuizSubmission(existingSubmissionId),
        getQuizResult(existingSubmissionId),
      ]);

      if (!existing) {
        return new Response(
          JSON.stringify({ error: "Submission not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if result already exists (avoid re-generation)
      if (existingResult) {
        console.log(
          `[Quiz] Returning existing result for: ${existingSubmissionId}`
        );
        return new Response(
          JSON.stringify({
            id: existingSubmissionId,
            report: existingResult.report,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // Use stored submission data for generation
      variant = existing.variant;
      name = existing.name;
      answers = existing.answers;
      recordId = existingSubmissionId;
      console.log(
        `[Quiz] Retrying generation for existing submission: ${recordId}`
      );
    } else {
      // New submission: resolve variant
      const variantSlug =
        typeof body.variant === "string" ? body.variant : undefined;
      if (!variantSlug) {
        return new Response(
          JSON.stringify({ error: "Missing variant field" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const variantConfig = getVariant(variantSlug);
      if (!variantConfig) {
        return new Response(
          JSON.stringify({ error: `Unknown quiz variant: ${variantSlug}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate against variant-specific schema
      const schema = buildSubmissionSchema(variantConfig);
      const parsed = schema.safeParse(body);

      if (!parsed.success) {
        return new Response(
          JSON.stringify({
            error: "Invalid submission",
            details: parsed.error.flatten(),
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      variant = parsed.data.variant;
      name = parsed.data.name;
      answers = parsed.data.answers;

      // Save new submission
      const record = await upsertQuizSubmission({ variant, name, answers });
      recordId = record.id;
      console.log(`[Quiz] New submission saved: ${recordId}`);
    }

    // Resolve variant config for prompt building
    const variantConfig = getVariant(variant);
    if (!variantConfig) {
      throw new Error(`Variant config not found for: ${variant}`);
    }

    // Build system prompt + user message
    const { system, userMessage } = await buildQuizPrompt(variantConfig, name, answers);

    // Generate report with evidence tools
    console.log(`[Quiz] Starting generation for: ${recordId} (variant: ${variant})`);
    const genStart = Date.now();

    // System prompt is stable per variant (knowledge files + instructions) — cache it
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      messages: [
        {
          role: "system" as const,
          content: system,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        },
        { role: "user" as const, content: userMessage },
      ],
      tools: cachedTools,
      stopWhen: stepCountIs(10),
      prepareStep: ({ messages: stepMessages }) => ({
        messages: cacheManager.applyHistoryCacheBreakpoint(stepMessages),
      }),
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
      `[Quiz] Complete: ${recordId} · ${toolSummary || "no tools"} · ~${totalToolTokens} tok to agent · ${result.steps.length} steps`
    );
    console.log(
      `[Quiz] Tokens: in: ${result.usage.inputTokens} · out: ${result.usage.outputTokens} · ${(genMs / 1000).toFixed(1)}s`
    );

    // Cache & cost breakdown
    const d = result.usage.inputTokenDetails;
    const cacheRead = d.cacheReadTokens ?? 0;
    const cacheWrite = d.cacheWriteTokens ?? 0;
    const noCache = d.noCacheTokens ?? 0;
    const totalInput = result.usage.inputTokens ?? 0;
    const totalOutput = result.usage.outputTokens ?? 0;
    const hitRate =
      totalInput > 0 ? ((cacheRead / totalInput) * 100).toFixed(1) : "0.0";

    const costRead = cacheRead * PRICE_READ;
    const costWrite = cacheWrite * PRICE_WRITE;
    const costNoCache = noCache * PRICE_INPUT;
    const costOutput = totalOutput * PRICE_OUTPUT;
    const costTotal = costRead + costWrite + costNoCache + costOutput;
    const costBaseline =
      totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;
    const savings = costBaseline - costTotal;

    console.log(
      `[Quiz] Cache: read: ${cacheRead} · write: ${cacheWrite} · uncached: ${noCache} · hit: ${hitRate}%`
    );
    console.log(
      `[Quiz] Cost: in: $${(costRead + costWrite + costNoCache).toFixed(4)} · out: $${costOutput.toFixed(4)} · total: $${costTotal.toFixed(4)} · saved: $${savings.toFixed(4)}`
    );

    // Save result
    await saveQuizResult({
      id: recordId!,
      report: result.text,
    });

    console.log(`[Quiz] Result saved for: ${recordId}`);

    // Return response
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

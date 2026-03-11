// app/api/assessment/intake/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output } from "ai";
import { z } from "zod";

import { buildIntakePrompt } from "./prompt";
import { requestRateLimiter, extractIp } from "@/app/api/agent/lib/rateLimit";
import type { IntakeStep } from "../types";

export const maxDuration = 30;

// Sonnet 4.6 pricing (per token)
const PRICE_INPUT = 3 / 1_000_000;
const PRICE_WRITE = 3.75 / 1_000_000;
const PRICE_READ = 0.3 / 1_000_000;
const PRICE_OUTPUT = 15 / 1_000_000;

const intakeStepSchema = z.object({
  question: z
    .string()
    .describe(
      "The question to present. Concise, no em dashes."
    ),
  options: z
    .array(
      z.object({
        value: z.string().describe("Machine-readable identifier"),
        label: z.string().describe("Display text shown as a selectable chip"),
      })
    )
    .describe(
      "Contextually relevant preset options. Should feel like 'yes, that's me' recognitions."
    ),
  freeTextPlaceholder: z
    .string()
    .describe(
      "Contextual placeholder guiding what additional detail would be helpful"
    ),
  status: z
    .enum(["in_progress", "optional", "complete"])
    .describe(
      "in_progress: core areas still being covered. optional: core areas complete, targeted follow-up the user may skip. complete: intake finished."
    ),
  progressEstimate: z
    .number()
    .describe("Estimated progress through the intake, a decimal from 0 (just starting) to 1 (complete)"),
  multiSelect: z
    .boolean()
    .describe("Whether the user can select multiple options"),
});

const inputSchema = z.object({
  steps: z
    .array(
      z.object({
        question: z.string().max(500),
        selectedOptions: z.array(z.string()),
        freeText: z.string().max(2000),
      })
    )
    .max(20),
});

export async function POST(req: Request) {
  // Rate limiting
  const ip = extractIp(req);
  const rateCheck = requestRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    console.log(
      `[Intake] Rate limited: ${ip} (retry after ${rateCheck.retryAfterSeconds}s)`
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

  const steps: IntakeStep[] = parsed.data.steps;

  try {
    const { system, userMessage } = await buildIntakePrompt(steps);

    console.log(
      `[Intake] Generating next step (${steps.length} steps so far)`
    );
    const genStart = Date.now();

    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      output: Output.object({ schema: intakeStepSchema }),
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
    });

    if (!result.output) {
      throw new Error("Failed to generate structured output");
    }

    const genMs = Date.now() - genStart;
    console.log(
      `[Intake] Complete · status: ${result.output.status} · progress: ${result.output.progressEstimate} · ${(genMs / 1000).toFixed(1)}s`
    );
    console.log(
      `[Intake] Tokens: in: ${result.usage.inputTokens} · out: ${result.usage.outputTokens}`
    );

    // Cache performance
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
      `[Intake] Cache: read: ${cacheRead} · write: ${cacheWrite} · uncached: ${noCache} · hit: ${hitRate}%`
    );
    console.log(
      `[Intake] Cost: in: $${(costRead + costWrite + costNoCache).toFixed(4)} · out: $${costOutput.toFixed(4)} · total: $${costTotal.toFixed(4)} · saved: $${savings.toFixed(4)}`
    );

    return new Response(JSON.stringify(result.output), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Intake] Generation failed:", error);
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

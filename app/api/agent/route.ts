// app/api/agent/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { agentTools } from "./tools";
import { buildAgentPrompt, buildStandalonePrompt } from "./systemPrompt";
import { CacheManager } from "./lib/cacheManager";
import { requestRateLimiter, extractIp } from "./lib/rateLimit";
import { validateInput } from "./lib/inputValidation";
import { getQuizSubmission } from "@/server/quizSubmissions";
import { getQuizResult } from "@/server/quizResults";
import { getVariant } from "@/lib/quiz/variants";

export const maxDuration = 300;

const cacheManager = new CacheManager();
const cachedTools = cacheManager.prepareCachedTools(agentTools);

// Opus 4.6 pricing (per token)
const PRICE_INPUT = 15 / 1_000_000;
const PRICE_WRITE = 18.75 / 1_000_000;
const PRICE_READ = 1.5 / 1_000_000;
const PRICE_OUTPUT = 75 / 1_000_000;

export async function POST(req: Request) {
  const requestStart = Date.now();

  // Rate limiting
  const ip = extractIp(req);
  const rateCheck = requestRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    console.log(
      `[Agent] Rate limited: ${ip} (retry after ${rateCheck.retryAfterSeconds}s)`
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

  let body: { messages: UIMessage[]; quizId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { messages, quizId } = body;

  // Input validation
  const validation = validateInput(messages);
  if (!validation.valid) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: validation.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build system prompt based on mode
  let prompt: { stable: string; dynamic: string };
  const mode = quizId ? "quiz" : "chat";

  if (quizId) {
    // Post-quiz mode: load quiz context
    const [submission, quizResult] = await Promise.all([
      getQuizSubmission(quizId),
      getQuizResult(quizId),
    ]);

    if (!submission || !quizResult) {
      return new Response(
        JSON.stringify({ error: "Quiz data not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const variantConfig = getVariant(submission.variant);
    if (!variantConfig) {
      return new Response(
        JSON.stringify({ error: `Unknown variant: ${submission.variant}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    prompt = await buildAgentPrompt(
      variantConfig,
      submission.name,
      submission.answers,
      quizResult.report
    );
  } else {
    // Standalone chat mode: no quiz context
    prompt = await buildStandalonePrompt();
  }

  // Three-tier caching: system messages (stable cached, dynamic fresh)
  const systemMessages = cacheManager.buildCachedSystemMessages(prompt);

  // Start async conversion early, await late
  const modelMessagesPromise = convertToModelMessages(messages);
  const modelMessages = await modelMessagesPromise;
  const initialMessages = [...systemMessages, ...modelMessages];

  const userMessage = messages.filter((m) => m.role === "user").pop();
  const lastText = userMessage?.parts?.find((p) => p.type === "text");
  const preview =
    lastText && "text" in lastText ? lastText.text.substring(0, 80) : "?";
  const tag = `Agent:${mode}`;
  console.log(`\n[${tag}] ══ Request ══`);
  console.log(
    `[${tag}] ${quizId ? `Quiz: ${quizId.slice(0, 8)} · ` : ""}Messages: ${messages.length} · "${preview}..."`
  );
  console.log(
    `[${tag}] System messages: ${systemMessages.length}, Model messages: ${modelMessages.length}`
  );
  console.log(
    `[${tag}] Streaming with Opus 4.6 (thinking: adaptive, effort: low, max steps: 10)`
  );

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: anthropic("claude-opus-4-6"),
        messages: initialMessages,
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
                {
                  type: "clear_tool_uses_20250919",
                  trigger: { type: "input_tokens", value: 50_000 },
                  keep: { type: "tool_uses", value: 15 },
                  clearAtLeast: { type: "input_tokens", value: 8_000 },
                },
                {
                  type: "compact_20260112",
                  trigger: { type: "input_tokens", value: 120_000 },
                },
              ],
            },
          },
        },
        onFinish: ({ usage, steps, totalUsage }) => {
          const toolCounts: Record<string, number> = {};
          let totalToolTokens = 0;
          for (const step of steps) {
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                toolCounts[tc.toolName] =
                  (toolCounts[tc.toolName] ?? 0) + 1;
              }
            }
            if (step.toolResults) {
              for (const tr of step.toolResults) {
                try {
                  totalToolTokens += Math.round(
                    JSON.stringify(tr).length / 4
                  );
                } catch {
                  /* skip */
                }
              }
            }
          }
          const toolSummary =
            Object.entries(toolCounts)
              .map(([name, count]) => `${count} ${name}`)
              .join(" + ") || "no tools";

          const genMs = Date.now() - requestStart;
          console.log(`\n[Agent] ══ Complete ══`);
          console.log(
            `[Agent] ${toolSummary} · ~${totalToolTokens} tok to agent · ${steps.length} steps`
          );
          console.log(
            `[Agent] Tokens: in: ${totalUsage.inputTokens} · out: ${totalUsage.outputTokens} · context: ${usage.inputTokens} · ${(genMs / 1000).toFixed(1)}s`
          );

          // Cache performance
          const d = totalUsage.inputTokenDetails;
          const cacheRead = d.cacheReadTokens ?? 0;
          const cacheWrite = d.cacheWriteTokens ?? 0;
          const noCache = d.noCacheTokens ?? 0;
          const totalInput = totalUsage.inputTokens ?? 0;
          const totalOutput = totalUsage.outputTokens ?? 0;
          const hitRate =
            totalInput > 0
              ? ((cacheRead / totalInput) * 100).toFixed(1)
              : "0.0";

          const costRead = cacheRead * PRICE_READ;
          const costWrite = cacheWrite * PRICE_WRITE;
          const costNoCache = noCache * PRICE_INPUT;
          const costOutput = totalOutput * PRICE_OUTPUT;
          const costTotal = costRead + costWrite + costNoCache + costOutput;
          const costBaseline =
            totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;
          const savings = costBaseline - costTotal;

          console.log(
            `[Agent] Cache: read: ${cacheRead} · write: ${cacheWrite} · uncached: ${noCache} · hit: ${hitRate}%`
          );
          console.log(
            `[Agent] Cost: in: ${(costRead + costWrite + costNoCache).toFixed(4)} · out: ${costOutput.toFixed(4)} · total: ${costTotal.toFixed(4)} · saved: ${savings.toFixed(4)}`
          );

          // Context management events
          for (const step of steps) {
            const meta = step.providerMetadata?.anthropic as
              | Record<string, unknown>
              | undefined;
            const cm = meta?.contextManagement as
              | {
                  appliedEdits?: Array<{
                    type: string;
                    clearedInputTokens?: number;
                    clearedToolUses?: number;
                    clearedThinkingTurns?: number;
                  }>;
                }
              | undefined;
            if (cm?.appliedEdits?.length) {
              for (const edit of cm.appliedEdits) {
                if (edit.type === "compact_20260112") {
                  console.log(
                    `[Agent] ⚠ Compaction triggered: conversation was summarized`
                  );
                } else if (edit.type === "clear_tool_uses_20250919") {
                  console.log(
                    `[Agent] Context edit: cleared ${edit.clearedToolUses} tool uses (${edit.clearedInputTokens} tokens)`
                  );
                } else if (edit.type === "clear_thinking_20251015") {
                  console.log(
                    `[Agent] Context edit: cleared ${edit.clearedThinkingTurns} thinking turns (${edit.clearedInputTokens} tokens)`
                  );
                }
              }
            }
          }
        },
        onError: ({ error }) => {
          console.error(`[Agent] Stream error:`, error);
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}

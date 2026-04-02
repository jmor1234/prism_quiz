// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import {
  streamText,
  type UIMessage,
  convertToModelMessages,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from 'ai';
import { retrieveEvidenceTool } from './tools/researchTool/researchTool';
import { readSourceTool } from './tools/readTool/readTool';
import { extractFindingsTool } from './tools/depthTool/depthTool';
import { CacheManager } from './lib/cacheManager';
import { extractIp, requestRateLimiter } from './lib/rateLimit';
import { validateInput } from './lib/inputValidation';

export const maxDuration = 300;

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export async function POST(req: Request) {
  const requestStart = Date.now();

  // === Rate limiting (before parsing body) ===
  const ip = extractIp(req);
  const rateCheck = requestRateLimiter.check(ip);
  if (!rateCheck.allowed) {
    console.log(`[Route] Rate limited: ${ip} (retry after ${rateCheck.retryAfterSeconds}s)`);
    return new Response(
      'You\u2019re sending messages too quickly. Please wait a moment and try again.',
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfterSeconds ?? 60) },
      },
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  // === Input validation ===
  const validation = validateInput(messages);
  if (!validation.valid) {
    console.log(`[Route] Validation failed: ${validation.error} (${ip})`);
    return new Response(validation.error, { status: validation.status });
  }

  const userMessage = messages.filter((m) => m.role === 'user').pop();
  const lastText = userMessage?.parts?.find((p) => p.type === 'text');
  const preview = lastText && 'text' in lastText ? lastText.text.substring(0, 80) : '?';
  console.log(`\n[Route] ══ Request Start ══`);
  console.log(`[Route] Messages: ${messages.length} (latest: "${preview}...")`);

  const cache = new CacheManager();

  const formattedDate = dateFormatter.format(new Date());

  // Start async conversion early, await late (async-api-routes pattern)
  const modelMessagesPromise = convertToModelMessages(messages);

  // Three-tier caching (sync work overlaps with message conversion)
  const systemMessages = cache.buildCachedSystemMessages(formattedDate);
  const cachedTools = cache.prepareCachedTools({
    retrieve_evidence: retrieveEvidenceTool,
    read_source: readSourceTool,
    extract_findings: extractFindingsTool,
  });

  const modelMessages = await modelMessagesPromise;
  const initialMessages = [...systemMessages, ...modelMessages];

  console.log(`[Route] System messages: ${systemMessages.length}, Model messages: ${modelMessages.length}`);
  console.log(`[Route] Streaming with Sonnet 4.6 (thinking: adaptive, effort: medium, max steps: 50)`);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: anthropic('claude-sonnet-4-6'),
        messages: initialMessages,
        tools: cachedTools,
        stopWhen: stepCountIs(50),
        prepareStep: ({ messages }) => ({
          messages: cache.applyHistoryCacheBreakpoint(messages),
        }),
        providerOptions: {
          anthropic: {
            thinking: { type: 'adaptive' },
            effort: 'low',
            contextManagement: {
              edits: [
                {
                  type: 'clear_thinking_20251015',
                  keep: 'all',
                },
                {
                  type: 'clear_tool_uses_20250919',
                  trigger: { type: 'input_tokens', value: 100_000 },
                  keep: { type: 'tool_uses', value: 15 },
                  clearAtLeast: { type: 'input_tokens', value: 15_000 },
                },
                {
                  type: 'compact_20260112',
                  trigger: { type: 'input_tokens', value: 150_000 },
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
                toolCounts[tc.toolName] = (toolCounts[tc.toolName] || 0) + 1;
              }
            }
            if (step.toolResults) {
              for (const tr of step.toolResults) {
                try { totalToolTokens += Math.round(JSON.stringify(tr).length / 4); } catch { /* */ }
              }
            }
          }
          const toolSummary = Object.entries(toolCounts)
            .map(([name, count]) => `${count} ${name}`)
            .join(' + ');
          console.log(`\n[Route] ══ Complete ══`);
          console.log(`[Route] ${toolSummary || 'no tools'} · ~${totalToolTokens} tok to agent · ${steps.length} steps`);
          console.log(`[Route] Tokens — in: ${totalUsage.inputTokens} · out: ${totalUsage.outputTokens} · context: ${usage.inputTokens} · ${((Date.now() - requestStart) / 1000).toFixed(1)}s`);

          // Cache performance
          const d = totalUsage.inputTokenDetails;
          const cacheRead = d.cacheReadTokens ?? 0;
          const cacheWrite = d.cacheWriteTokens ?? 0;
          const noCache = d.noCacheTokens ?? 0;
          const totalInput = totalUsage.inputTokens ?? 0;
          const totalOutput = totalUsage.outputTokens ?? 0;
          const hitRate = totalInput > 0 ? ((cacheRead / totalInput) * 100).toFixed(1) : '0.0';

          // Sonnet 4.6 pricing (per token)
          const PRICE_INPUT  = 3    / 1_000_000;
          const PRICE_WRITE  = 3.75 / 1_000_000;
          const PRICE_READ   = 0.30 / 1_000_000;
          const PRICE_OUTPUT = 15   / 1_000_000;

          const costRead    = cacheRead * PRICE_READ;
          const costWrite   = cacheWrite * PRICE_WRITE;
          const costNoCache = noCache * PRICE_INPUT;
          const costOutput  = totalOutput * PRICE_OUTPUT;
          const costTotal   = costRead + costWrite + costNoCache + costOutput;
          const costBaseline = totalInput * PRICE_INPUT + totalOutput * PRICE_OUTPUT;
          const savings = costBaseline - costTotal;

          console.log(`[Route] Cache — read: ${cacheRead} · write: ${cacheWrite} · uncached: ${noCache} · hit: ${hitRate}%`);
          console.log(`[Route] Cost  — in: $${(costRead + costWrite + costNoCache).toFixed(4)} · out: $${costOutput.toFixed(4)} · total: $${costTotal.toFixed(4)} · saved: $${savings.toFixed(4)}`);

          // Context management events
          for (const step of steps) {
            const meta = step.providerMetadata?.anthropic as Record<string, unknown> | undefined;
            const cm = meta?.contextManagement as { appliedEdits?: Array<{ type: string; clearedInputTokens?: number; clearedToolUses?: number; clearedThinkingTurns?: number }> } | undefined;
            if (cm?.appliedEdits?.length) {
              for (const edit of cm.appliedEdits) {
                if (edit.type === 'compact_20260112') {
                  console.log(`[Route] ⚠ Compaction triggered — conversation was summarized`);
                } else if (edit.type === 'clear_tool_uses_20250919') {
                  console.log(`[Route] Context edit — cleared ${edit.clearedToolUses} tool uses (${edit.clearedInputTokens} tokens)`);
                } else if (edit.type === 'clear_thinking_20251015') {
                  console.log(`[Route] Context edit — cleared ${edit.clearedThinkingTurns} thinking turns (${edit.clearedInputTokens} tokens)`);
                }
              }
            }
          }
        },
        onError: ({ error }) => {
          console.error(`[Route] Stream error:`, error);
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}

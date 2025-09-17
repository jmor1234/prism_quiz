// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, UIMessage, stepCountIs, type ModelMessage } from 'ai';
import { thinkTool } from './tools/thinkTool/think-tool';
import { researchMemoryTool } from './tools/researchMemoryTool/researchMemoryTool';
import { targetedExtractionTool } from './tools/targetedExtractionTool/targetedExtractionTool';
import { executeResearchPlanTool } from './tools/executeResearchPlanTool/executeResearchPlanTool';
import { TraceLogger, asyncLocalStorage } from './lib/traceLogger';
import { buildSystemPrompt } from './systemPrompt';

export const maxDuration = 300;

// Session-level token tracking (persists until server restart)
interface SessionTokens {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  totalCostSavings: number;
  totalActualCost: number;
  totalCostWithoutCache: number;
  sessionStartTime: Date;
}

const sessionTokens: SessionTokens = {
  totalRequests: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  totalCachedTokens: 0,
  totalCostSavings: 0,
  totalActualCost: 0,
  totalCostWithoutCache: 0,
  sessionStartTime: new Date(),
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Initialize per-request trace logger and run the request in its async context
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === 'true';
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);
  logger.logInitialMessages(messages as unknown as unknown[]);

  return await asyncLocalStorage.run(logger, async () => {
    let stepIndex = 0;
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // === CACHE CONTROL UTILITIES ===========================================
    function withAnthropicToolCache<T extends Record<string, unknown>>(toolDef: T): T {
      const existingProviderOptions = (toolDef as {providerOptions?: Record<string, unknown>}).providerOptions || {};
      const existingAnthropic = (existingProviderOptions as {anthropic?: Record<string, unknown>}).anthropic || {};
      
      return {
        ...toolDef,
        providerOptions: {
          ...existingProviderOptions,
          anthropic: {
            ...existingAnthropic,
            cacheControl: { type: 'ephemeral', ttl: '1h' },
          },
        },
      };
    }

    function addHistoryCacheBreakpoint(msgs: ModelMessage[]) {
      // Find index of the *last* user message (the current user turn)
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      // Cache boundary is the message just before that last user turn
      const boundaryIdx = lastUserIdx > 0 ? lastUserIdx - 1 : -1;
      if (boundaryIdx >= 0 && msgs[boundaryIdx]) {
        // Attach cache control at the message level
        const m = msgs[boundaryIdx] as ModelMessage & {
          providerOptions?: {
            anthropic?: {
              cacheControl?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
              [key: string]: unknown;
            };
            [key: string]: unknown;
          };
        };
        const existingProviderOptions = m.providerOptions || {};
        const existingAnthropic = (existingProviderOptions.anthropic as Record<string, unknown>) || {};
        
        m.providerOptions = {
          ...existingProviderOptions,
          anthropic: {
            ...existingAnthropic,
            cacheControl: { type: 'ephemeral', ttl: '5m' },
          },
        };
      }
    }

    // === SYSTEM PROMPT (split into stable + dynamic; cached) ===============
    const { stable, dynamic } = buildSystemPrompt(formattedDate);
    
    // Convert UI messages to model messages (required for providerOptions)
    const modelMessages: ModelMessage[] = convertToModelMessages(messages);

    // Create cached stable system message (1h TTL - reused across days)
    const cachedSystemMsg: ModelMessage = {
      role: 'system',
      content: stable,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } },
      },
    };

    // Create dynamic system message (no cache - changes daily)
    const dynamicSystemMsg: ModelMessage = {
      role: 'system', 
      content: dynamic,
    };

    // === TOOLS (cache definitions via breakpoint on last tool) ==============
    // Apply cache control to the last tool only (caches entire tool schema set)
    const cachedExecuteResearchPlanTool = withAnthropicToolCache(executeResearchPlanTool);
    
    const cachedTools = {
      thinkTool,
      researchMemoryTool, 
      targetedExtractionTool,
      executeResearchPlanTool: cachedExecuteResearchPlanTool,
    };

    // === CONVERSATION HISTORY CACHE SETUP ==================================
    // Build final messages array: cached system + dynamic system + conversation
    const initialMessages: ModelMessage[] = [
      cachedSystemMsg,    // Cached stable instructions
      dynamicSystemMsg,   // Fresh daily context
      ...modelMessages    // Conversation history
    ];
    
    // Apply history cache breakpoint for initial request
    addHistoryCacheBreakpoint(initialMessages);

    // === STREAMING WITH CACHING ============================================
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      // NOTE: do *not* use system param; we use cached system messages above
      messages: initialMessages,
      tools: cachedTools,
      
      // Agentic controls (v5): limit sequential steps to prevent runaway loops
      stopWhen: stepCountIs(50),

      // Re-apply history cache breakpoint before each step for multi-step loops
      prepareStep: async ({ messages }) => {
        const msgs = [...messages];
        addHistoryCacheBreakpoint(msgs);
        return { messages: msgs };
      },
      // Observability for each step
      onStepFinish: (step) => {
        stepIndex += 1;
        logger.logToolInternalStep('primary_agent', 'STEP_FINISH', {
          stepIndex,
          finishReason: step.finishReason,
          usage: step.usage,
          toolCalls: step.toolCalls.map((tc) => ({ toolName: tc.toolName })),
        });

        // Console visibility for token usage per step (total only)
        const u = step.usage as unknown as { totalTokens?: number };
        console.log(`\n==================== TOKENS (STEP ${stepIndex}) ====================`);
        console.log(`🧮 total: ${u.totalTokens ?? 'n/a'}`);
        console.log(`==================================================================`);

        // Capture planning thoughts from thinkTool calls
        const thinkCall = step.toolCalls.find((tc) => tc.toolName === 'thinkTool') as unknown as { args?: { thought?: string } } | undefined;
        const thought = thinkCall?.args?.thought;
        if (thought && typeof thought === 'string') {
          logger.logAgentPlanning(thought);
        }
      },
      // Provider-specific options
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 16000 },
        },
      },
      // Finalize logs when the run completes
      onFinish: async (event) => {
        const runTotal = (event.totalUsage as unknown as { totalTokens?: number })?.totalTokens;
        
        // === ENHANCED CACHE OBSERVABILITY ==================================
        interface AnthropicCacheMetadata {
          cache_read_input_tokens?: number;
          cache_creation_input_tokens?: number;
          [key: string]: unknown;
        }
        
        interface EventWithMetadata {
          providerMetadata?: {
            anthropic?: AnthropicCacheMetadata;
          };
          totalUsage?: {
            inputTokens?: number;
            outputTokens?: number;
            totalTokens?: number;
            cachedInputTokens?: number;
            [key: string]: unknown;
          };
        }
        
        const eventWithMeta = event as EventWithMetadata;
        
        // Extract token data
        const requestInputTokens = eventWithMeta.totalUsage?.inputTokens || 0;
        const requestOutputTokens = eventWithMeta.totalUsage?.outputTokens || 0;
        const requestTotalTokens = requestInputTokens + requestOutputTokens;
        
        // Try to get detailed cache metadata from providerMetadata
        const anthroMeta = eventWithMeta.providerMetadata?.anthropic;
        let cacheReadTokens = 0;
        let cacheCreateTokens = 0;
        
        if (anthroMeta) {
          cacheReadTokens = anthroMeta.cache_read_input_tokens || 0;
          cacheCreateTokens = anthroMeta.cache_creation_input_tokens || 0;
        }
        
        // Fallback: Use cachedInputTokens from usage (more reliable)
        const usageCachedTokens = eventWithMeta.totalUsage?.cachedInputTokens || 0;
        const effectiveCacheReadTokens = Math.max(cacheReadTokens, usageCachedTokens);
        
        // Claude Sonnet 4 pricing (per million tokens)
        const SONNET_4_INPUT_PRICE = 3.00;     // $3.00/MTok
        const SONNET_4_CACHE_PRICE = 0.30;     // $0.30/MTok  
        const SONNET_4_OUTPUT_PRICE = 15.00;   // $15.00/MTok
        
        // Calculate real costs in USD
        const freshInputCost = (requestInputTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
        const cacheReadCost = (effectiveCacheReadTokens / 1_000_000) * SONNET_4_CACHE_PRICE;
        const outputCost = (requestOutputTokens / 1_000_000) * SONNET_4_OUTPUT_PRICE;
        const totalCostWithCache = freshInputCost + cacheReadCost + outputCost;
        
        // Cost without caching (all input at full price)
        const conversationContextTokens = requestInputTokens + effectiveCacheReadTokens;
        const allInputCost = (conversationContextTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
        const totalCostWithoutCache = allInputCost + outputCost;
        const realCostSavings = totalCostWithoutCache - totalCostWithCache;
        
        // Update session totals
        sessionTokens.totalRequests += 1;
        sessionTokens.totalInputTokens += requestInputTokens;
        sessionTokens.totalOutputTokens += requestOutputTokens;
        sessionTokens.totalTokens += requestTotalTokens;
        sessionTokens.totalCachedTokens += effectiveCacheReadTokens;
        sessionTokens.totalCostSavings += realCostSavings;
        sessionTokens.totalActualCost += totalCostWithCache;
        sessionTokens.totalCostWithoutCache += totalCostWithoutCache;
        
        // Calculate cache metrics (more intuitive)
        const cacheMultiplier = requestInputTokens > 0 ? effectiveCacheReadTokens / requestInputTokens : 0;
        const trueCacheEfficiency = conversationContextTokens > 0 ? effectiveCacheReadTokens / conversationContextTokens : 0;
        
        // Session metrics that make sense
        const sessionTotalContextTokens = sessionTokens.totalInputTokens + sessionTokens.totalCachedTokens;
        const sessionCacheEfficiency = sessionTotalContextTokens > 0 ? sessionTokens.totalCachedTokens / sessionTotalContextTokens : 0;
        const sessionCacheMultiplier = sessionTokens.totalInputTokens > 0 ? sessionTokens.totalCachedTokens / sessionTokens.totalInputTokens : 0;
        const sessionUptime = Math.floor((Date.now() - sessionTokens.sessionStartTime.getTime()) / 1000 / 60); // minutes
        
        console.log(`\n====================== TOKENS (RUN) =======================`);
        console.log(`🧾 Request: ${requestTotalTokens.toLocaleString()} tokens (computed this request)`);
        console.log(`💬 Conversation: ${conversationContextTokens.toLocaleString()} tokens (full context: ${requestInputTokens.toLocaleString()} fresh + ${effectiveCacheReadTokens.toLocaleString()} cached)`);
        console.log(`📊 API Session: ${sessionTokens.totalTokens.toLocaleString()} tokens (${sessionTokens.totalRequests} requests, ${sessionUptime}min uptime)`);
        
        console.log(`\n📦 CACHE PERFORMANCE:`);
        console.log(`   🔄 Cache Multiplier: ${cacheMultiplier.toFixed(1)}x (${effectiveCacheReadTokens.toLocaleString()} cached ÷ ${requestInputTokens.toLocaleString()} fresh)`);
        console.log(`   📊 True Efficiency: ${(trueCacheEfficiency * 100).toFixed(1)}% (${effectiveCacheReadTokens.toLocaleString()}/${conversationContextTokens.toLocaleString()} of conversation cached)`);
        console.log(`   📈 Session Efficiency: ${(sessionCacheEfficiency * 100).toFixed(1)}% (${sessionTokens.totalCachedTokens.toLocaleString()}/${sessionTotalContextTokens.toLocaleString()} total context cached)`);
        console.log(`   🔁 Session Multiplier: ${sessionCacheMultiplier.toFixed(1)}x (${sessionTokens.totalCachedTokens.toLocaleString()} cached ÷ ${sessionTokens.totalInputTokens.toLocaleString()} fresh)`);
        
        console.log(`\n💰 REAL COSTS (Claude Sonnet 4):`);
        console.log(`   🔸 Request: $${totalCostWithCache.toFixed(5)} (with cache) vs $${totalCostWithoutCache.toFixed(5)} (without)`);
        console.log(`   💎 Session: $${sessionTokens.totalActualCost.toFixed(4)} (with cache) vs $${sessionTokens.totalCostWithoutCache.toFixed(4)} (without)`);
        console.log(`   🎯 Request Saved: $${realCostSavings.toFixed(5)} (${((realCostSavings/totalCostWithoutCache)*100).toFixed(1)}% cost reduction)`);
        console.log(`   🏆 Session Saved: $${sessionTokens.totalCostSavings.toFixed(4)} (${((sessionTokens.totalCostSavings/sessionTokens.totalCostWithoutCache)*100).toFixed(1)}% total reduction)`);
        console.log(`   📚 Cache Reads: ${effectiveCacheReadTokens.toLocaleString()} tokens @ $${SONNET_4_CACHE_PRICE}/MTok`);
        
        // Log to trace logger for analysis
        logger.logToolInternalStep('primary_agent', 'CACHE_PERFORMANCE', {
          provider: 'anthropic',
          request: {
            cacheMultiplier: Math.round(cacheMultiplier * 10) / 10, // 1 decimal place
            trueCacheEfficiency: Math.round(trueCacheEfficiency * 100),
            cacheReadTokens: effectiveCacheReadTokens,
            cacheCreateTokens,
            inputTokens: requestInputTokens,
            outputTokens: requestOutputTokens,
            conversationTokens: conversationContextTokens,
            totalTokens: requestTotalTokens,
            actualCostUSD: Math.round(totalCostWithCache * 100000) / 100000, // 5 decimal places
            costWithoutCacheUSD: Math.round(totalCostWithoutCache * 100000) / 100000,
            costSavingsUSD: Math.round(realCostSavings * 100000) / 100000,
            costReductionPercent: Math.round((realCostSavings/totalCostWithoutCache)*100 * 10) / 10,
          },
          session: {
            totalRequests: sessionTokens.totalRequests,
            totalTokens: sessionTokens.totalTokens,
            totalInputTokens: sessionTokens.totalInputTokens,
            totalCachedTokens: sessionTokens.totalCachedTokens,
            totalContextTokens: sessionTotalContextTokens,
            cacheEfficiency: Math.round(sessionCacheEfficiency * 100),
            cacheMultiplier: Math.round(sessionCacheMultiplier * 10) / 10,
            actualCostUSD: Math.round(sessionTokens.totalActualCost * 10000) / 10000, // 4 decimal places
            costWithoutCacheUSD: Math.round(sessionTokens.totalCostWithoutCache * 10000) / 10000,
            totalSavingsUSD: Math.round(sessionTokens.totalCostSavings * 10000) / 10000,
            totalCostReductionPercent: Math.round((sessionTokens.totalCostSavings/sessionTokens.totalCostWithoutCache)*100 * 10) / 10,
            uptimeMinutes: sessionUptime,
          },
          metadata: anthroMeta,
        });
        
        console.log(`==========================================================`);
        logger.logFinalResponse({
          text: event.text,
          finishReason: event.finishReason,
          usage: event.totalUsage,
        });
        await logger.finalizeAndWriteLog();
      },
      onError: async (e) => {
        await logger.finalizeAndWriteLog(e);
      },
      onAbort: async (event) => {
        await logger.finalizeAndWriteLog({ reason: 'aborted', steps: event.steps.length });
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  });
}
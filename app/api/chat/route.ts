// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, UIMessage, stepCountIs } from 'ai';
import { thinkTool } from './tools/thinkTool/think-tool';
import { researchMemoryTool } from './tools/researchMemoryTool/researchMemoryTool';
import { targetedExtractionTool } from './tools/targetedExtractionTool/targetedExtractionTool';
import { executeResearchPlanTool } from './tools/executeResearchPlanTool/executeResearchPlanTool';
import { TraceLogger, asyncLocalStorage } from './lib/traceLogger';
import { CacheManager } from './lib/cacheManager';
import { TokenEconomics } from './lib/tokenEconomics';
import { createStreamCallbacks } from './lib/streamCallbacks';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Debug: Log what messages we actually received
  console.log(`\n[DEBUG] Received ${messages.length} messages in request`);
  const messageTokenEstimate = JSON.stringify(messages).length / 4; // Rough estimate
  console.log(`[DEBUG] Estimated message size: ~${Math.round(messageTokenEstimate)} tokens`);

  // Initialize services
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === 'true';
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);
  logger.logInitialMessages(messages as unknown as unknown[]);

  const cache = new CacheManager();
  const economics = TokenEconomics.getInstance();

  return await asyncLocalStorage.run(logger, async () => {
    // Format date for system prompt
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Prepare cached components
    const systemMessages = cache.buildCachedSystemMessages(formattedDate);
    const cachedTools = cache.prepareCachedTools({
      thinkTool,
      researchMemoryTool,
      targetedExtractionTool,
      executeResearchPlanTool,
    });

    // Build messages with caching
    const modelMessages = convertToModelMessages(messages);
    const initialMessages = [...systemMessages, ...modelMessages];
    cache.addHistoryCacheBreakpoint(initialMessages);

    // Create stream callbacks with dependency injection
    const stepIndexRef = { current: 0 };
    const callbacks = createStreamCallbacks({
      logger,
      economics,
      cache,
      stepIndexRef,
    });

    // Stream with clean configuration
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      messages: initialMessages,
      tools: cachedTools,
      stopWhen: stepCountIs(50),
      ...callbacks,
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 16000 },
        },
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  });
}
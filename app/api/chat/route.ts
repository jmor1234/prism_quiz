// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  stepCountIs,
  createUIMessageStream,
  createUIMessageStreamResponse
} from 'ai';
import { thinkTool } from './tools/thinkTool/think-tool';
import { researchMemoryTool } from './tools/researchMemoryTool/researchMemoryTool';
import { targetedExtractionTool } from './tools/targetedExtractionTool/targetedExtractionTool';
import { executeResearchPlanTool } from './tools/executeResearchPlanTool/executeResearchPlanTool';
import { TraceLogger, asyncLocalStorage } from './lib/traceLogger';
import { CacheManager } from './lib/cacheManager';
import { TokenEconomics } from './lib/tokenEconomics';
import { createStreamCallbacks } from './lib/streamCallbacks';
import type { ResearchUIMessage } from '@/lib/streaming-types';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages, id }: { messages: UIMessage[]; id?: string } = await req.json();

  // Debug: Log what messages we actually received
  console.log(`\n[DEBUG] Received ${messages.length} messages in request`);

  // Initialize services
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === 'true';
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);
  logger.logInitialMessages(messages as unknown as unknown[]);

  const cache = new CacheManager();
  const economics = TokenEconomics.getInstance();

  // Check persistent context warning before processing
  if (id) {
    const contextWarning = economics.getPersistentContextWarning(id);

    // Block if over 100k tokens
    if (contextWarning.level === 'blocked') {
      return new Response(JSON.stringify({
        error: 'Context limit exceeded',
        message: 'This conversation has reached the maximum context size. Please start a new thread.',
        persistentTokens: contextWarning.persistentTokens
      }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

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
    const hasToolsRef = { current: false };
    const callbacks = createStreamCallbacks({
      logger,
      economics,
      cache,
      stepIndexRef,
      threadId: id,
      hasToolsRef,
    });

    // Create UI message stream with research progress capabilities
    const stream = createUIMessageStream<ResearchUIMessage>({
      execute: async ({ writer }) => {
        // Inject stream writer into logger for progress updates
        logger.setStreamWriter({
          write: (data: unknown) => writer.write(data as Parameters<typeof writer.write>[0])
        });

        // Emit context warning if needed
        if (id) {
          const contextWarning = economics.getPersistentContextWarning(id);
          if (contextWarning.level !== 'none') {
            logger.emitContextWarning({
              level: contextWarning.level as 'notice' | 'warning' | 'critical',
              persistentTokens: contextWarning.persistentTokens,
              message: contextWarning.message
            });
          }
        }

        // Stream with clean configuration (preserving all existing config)
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

        // Merge model stream into UI message stream
        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({ stream });
  });
}
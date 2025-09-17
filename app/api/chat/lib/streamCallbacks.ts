// app/api/chat/lib/streamCallbacks.ts

import { TraceLogger } from './traceLogger';
import { TokenEconomics } from './tokenEconomics';
import { CacheManager } from './cacheManager';
import type { ModelMessage } from 'ai';

interface StepFinishEvent {
  finishReason: string;
  usage: unknown;
  toolCalls: Array<{ toolName: string; args?: unknown }>;
}

interface FinishEvent {
  text: string;
  finishReason: string;
  totalUsage: unknown;
  providerMetadata?: unknown;
  [key: string]: unknown;
}

// Type augmentation for economics module compatibility
interface EventWithMetadata {
  text: string;
  finishReason: string;
  providerMetadata?: {
    anthropic?: {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      [key: string]: unknown;
    };
  };
  totalUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface AbortEvent {
  steps: unknown[];
}

interface StreamCallbackDeps {
  logger: TraceLogger;
  economics: TokenEconomics;
  cache: CacheManager;
  stepIndexRef: { current: number };
}

/**
 * Creates all streaming event callbacks with proper dependency injection
 */
export function createStreamCallbacks(deps: StreamCallbackDeps) {
  const { logger, economics, cache, stepIndexRef } = deps;

  return {
    /**
     * Handles step completion with logging and token tracking
     */
    onStepFinish: (step: StepFinishEvent) => {
      stepIndexRef.current += 1;

      // Log step details to trace
      logger.logToolInternalStep('primary_agent', 'STEP_FINISH', {
        stepIndex: stepIndexRef.current,
        finishReason: step.finishReason,
        usage: step.usage,
        toolCalls: step.toolCalls.map((tc) => ({ toolName: tc.toolName })),
      });

      // Console token visibility per step
      const u = step.usage as unknown as { totalTokens?: number };
      economics.formatStepTokens(stepIndexRef.current, u.totalTokens);

      // Capture planning thoughts from thinkTool calls
      const thinkCall = step.toolCalls.find((tc) => tc.toolName === 'thinkTool') as unknown as { args?: { thought?: string } } | undefined;
      const thought = thinkCall?.args?.thought;
      if (thought && typeof thought === 'string') {
        logger.logAgentPlanning(thought);
      }
    },

    /**
     * Handles stream completion with metrics and logging
     */
    onFinish: async (event: FinishEvent) => {
      // Calculate and log cache metrics
      const metrics = economics.updateFromEvent(event as EventWithMetadata);
      economics.formatConsoleOutput(metrics);

      // Log cache performance to trace
      logger.logToolInternalStep('primary_agent', 'CACHE_PERFORMANCE', {
        provider: 'anthropic',
        request: metrics.request,
        session: metrics.session,
        metadata: metrics.metadata,
      });

      // Log final response
      logger.logFinalResponse({
        text: event.text,
        finishReason: event.finishReason,
        usage: event.totalUsage,
      });

      // Finalize and write trace logs
      await logger.finalizeAndWriteLog();
    },

    /**
     * Handles errors with proper logging
     */
    onError: async (error: unknown) => {
      await logger.finalizeAndWriteLog(error);
    },

    /**
     * Handles stream abort with logging
     */
    onAbort: async (event: AbortEvent) => {
      await logger.finalizeAndWriteLog({
        reason: 'aborted',
        steps: event.steps.length
      });
    },

    /**
     * Prepares messages for next step with cache breakpoint
     */
    prepareStep: async ({ messages }: { messages: ModelMessage[] }) => {
      return {
        messages: cache.prepareMessagesForStep(messages)
      };
    },
  };
}
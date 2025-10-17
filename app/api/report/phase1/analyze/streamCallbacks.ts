// app/api/report/phase1/analyze/streamCallbacks.ts

import { TraceLogger } from '@/app/api/chat/lib/traceLogger';
import { TokenEconomics } from '@/app/api/chat/lib/tokenEconomics';
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

interface ReportStreamCallbackDeps {
  logger: TraceLogger;
  economics: TokenEconomics;
  stepIndexRef: { current: number };
  threadId?: string;
  hasToolsRef: { current: boolean };
}

/**
 * Creates all streaming event callbacks for report generation (no caching)
 */
export function createReportStreamCallbacks(deps: ReportStreamCallbackDeps) {
  const { logger, economics, stepIndexRef, threadId, hasToolsRef } = deps;

  return {
    /**
     * Handles step completion with logging and token tracking
     */
    onStepFinish: (step: StepFinishEvent) => {
      stepIndexRef.current += 1;

      // Track if tools were used in this request
      if (step.toolCalls.length > 0) {
        hasToolsRef.current = true;
      }

      // Log step details to trace
      logger.logToolInternalStep('primary_agent', 'STEP_FINISH', {
        stepIndex: stepIndexRef.current,
        finishReason: step.finishReason,
        usage: step.usage,
        toolCalls: step.toolCalls.map((tc) => ({ toolName: tc.toolName })),
      });

      // Capture planning thoughts from thinkTool calls
      const thinkCall = step.toolCalls.find((tc) => tc.toolName === 'thinkTool') as unknown as { args?: { thought?: string } } | undefined;
      const thought = thinkCall?.args?.thought;
      if (thought && typeof thought === 'string') {
        logger.logAgentPlanning(thought);
      }

      // Emit processing status after research tools complete
      const hasResearchTool = step.toolCalls.some((tc) =>
        tc.toolName === 'executeResearchPlanTool' ||
        tc.toolName === 'targetedExtractionTool'
      );

      if (hasResearchTool) {
        // Show thinking component while processing research results
        logger.emitToolStatus({
          toolName: 'thinkTool',
          action: 'Processing research findings...'
        });
      }
    },

    /**
     * Handles stream completion with metrics and logging
     */
    onFinish: async (event: FinishEvent) => {
      // Calculate and log metrics (pass tool usage flag)
      const metrics = economics.updateFromEvent(event as EventWithMetadata, {
        threadId,
        hasTools: hasToolsRef.current
      });
      economics.formatConsoleOutput(metrics);

      // Reset tool flag for next request
      hasToolsRef.current = false;

      // Log performance to trace
      logger.logToolInternalStep('primary_agent', 'PERFORMANCE', {
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
     * Prepares messages for next step (no caching for report)
     */
    prepareStep: async ({ messages }: { messages: ModelMessage[] }) => {
      return {
        messages
      };
    },
  };
}


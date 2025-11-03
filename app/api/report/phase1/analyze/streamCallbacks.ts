// app/api/report/phase1/analyze/streamCallbacks.ts
// Note: File name retained for minimal diff, but this is no longer streaming-specific

import { TraceLogger } from '@/lib/ai/traceLogger';
import { TokenEconomics } from '@/lib/ai/tokenEconomics';
import type { ModelMessage } from 'ai';

interface StepFinishEvent {
  finishReason: string;
  usage: unknown;
  toolCalls: Array<{ toolName: string; args?: unknown }>;
}

interface ReportCallbackDeps {
  logger: TraceLogger;
  economics: TokenEconomics;
  stepIndexRef: { current: number };
  threadId?: string;
  hasToolsRef: { current: boolean };
}

/**
 * Creates callbacks for report generation with generateText
 * Finalization logic (metrics, logging) moved to route.ts after await
 */
export function createReportCallbacks(deps: ReportCallbackDeps) {
  const { logger, stepIndexRef, hasToolsRef } = deps;

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

      // Note: Tool status emissions removed - no longer streamed to frontend in real-time
      // Frontend now uses simple loading state during generation
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


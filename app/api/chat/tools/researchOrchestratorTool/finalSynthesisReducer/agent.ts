import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import type { FinalSynthesisReducerInput } from './types';
import { finalSynthesisReducerOutputSchema, type FinalSynthesisReducerOutput } from './schema';
import { getFinalSynthesisReducerPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'finalSynthesisReducerAgent';
const LLM_MODEL_NAME = 'claude-sonnet-4-20250514';

export async function generateMergedFinalReport(
  input: FinalSynthesisReducerInput
): Promise<FinalSynthesisReducerOutput> {
  const logger = getLogger();
  let llmOutput: FinalSynthesisReducerOutput | null = null;
  let llmError: unknown = null;

  logger?.logToolCallStart(TOOL_NAME, {
    mainResearchObjective: input.researchPlan.focusedObjective.substring(0, 150),
    groupCount: input.groupReports.length,
  });

  try {
    const { object: result, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: anthropic(LLM_MODEL_NAME),
          schema: finalSynthesisReducerOutputSchema,
          prompt: getFinalSynthesisReducerPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'finalSynthesis', timeoutMs: getPhaseTimeoutMs('finalSynthesis') }
    );
    llmOutput = result as FinalSynthesisReducerOutput;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_SUCCESS', {
      usage,
      outputSummary: {
        thinkingLength: llmOutput.thinking?.length || 0,
        finalDocumentLength: llmOutput.finalDocument.length,
        claimSpansCount: llmOutput.claimSpans?.length || 0,
      },
    });
    // Console visibility for token usage
    console.log(`[` + TOOL_NAME + `] LLM merge complete for ` +
      `${input.groupReports.length} group report(s). ` +
      `📊 Tokens: ${usage.inputTokens?.toLocaleString?.() ?? 'n/a'} in / ` +
      `${usage.outputTokens?.toLocaleString?.() ?? 'n/a'} out / ` +
      `${(usage.totalTokens as number | undefined) ?? 'n/a'} total`);
  } catch (error) {
    llmError = error;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_ERROR', {
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    // Log non-timeout errors to console for quick visibility
    try {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : 'Error';
      const isTimeout = name === 'AbortError' || /timeout|abort|etimedout|operation was aborted/i.test(message);
      if (!isTimeout) {
        console.error(`[${TOOL_NAME}] Non-timeout error:`, error);
      }
    } catch {}
    throw new Error(
      `[${TOOL_NAME}] Merge synthesis LLM call failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  logger?.logToolCallEnd(TOOL_NAME, llmOutput, llmError);
  return llmOutput as FinalSynthesisReducerOutput;
}



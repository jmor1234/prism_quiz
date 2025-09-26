import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { FinalSynthesisAgentInput } from './types';
import type { FinalSynthesisAgentOutput } from './types';
import { getFinalSynthesisPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'finalSynthesisAgent';
const LLM_MODEL_NAME = 'gemini-2.5-flash-lite-latest';

export async function generateFinalReport(
  input: FinalSynthesisAgentInput
): Promise<FinalSynthesisAgentOutput> {
  const logger = getLogger();
  let llmOutput: FinalSynthesisAgentOutput | null = null;
  let llmError: unknown = null;
  const startedAt = Date.now();

  logger?.logToolCallStart(TOOL_NAME, {
    mainResearchObjective: input.researchPlan.focusedObjective.substring(0, 150),
    consolidatedDocumentsCount: input.consolidatedDocuments.length,
  });

  try {
    const { text, usage } = await withRetry(
      (signal) =>
        generateText({
          model: google(LLM_MODEL_NAME),
          prompt: getFinalSynthesisPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'finalSynthesis', timeoutMs: getPhaseTimeoutMs('finalSynthesis') }
    );
    llmOutput = { finalDocument: text } as FinalSynthesisAgentOutput;

    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_SUCCESS', {
      usage,
      outputSummary: {
        finalDocumentLength: llmOutput.finalDocument.length,
      },
    });
    // Console visibility for token usage (mirrors other agents' style)
    console.log(`[` + TOOL_NAME + `] LLM synthesis complete for ` +
      `${input.consolidatedDocuments.length} docs. ` +
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
      `[${TOOL_NAME}] Final synthesis LLM call failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    const durationMs = Date.now() - startedAt;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_DURATION', { duration_ms: durationMs });
    try { console.log(`[${TOOL_NAME}] Duration: ${durationMs} ms`); } catch {}
  }

  logger?.logToolCallEnd(TOOL_NAME, llmOutput, llmError);
  return llmOutput as FinalSynthesisAgentOutput;
}



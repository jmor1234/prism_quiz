import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { FinalSynthesisAgentInput } from './types';
import { finalSynthesisAgentOutputSchema, FinalSynthesisAgentOutput } from './schema';
import { getFinalSynthesisPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'finalSynthesisAgent';
const LLM_MODEL_NAME = 'gemini-2.5-flash-lite';

export async function generateFinalReport(
  input: FinalSynthesisAgentInput
): Promise<FinalSynthesisAgentOutput> {
  const logger = getLogger();
  let llmOutput: FinalSynthesisAgentOutput | null = null;
  let llmError: unknown = null;

  logger?.logToolCallStart(TOOL_NAME, {
    mainResearchObjective: input.researchPlan.focusedObjective.substring(0, 150),
    consolidatedDocumentsCount: input.consolidatedDocuments.length,
  });

  try {
    const { object: synthesisResult, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: google(LLM_MODEL_NAME),
          schema: finalSynthesisAgentOutputSchema,
          prompt: getFinalSynthesisPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'finalSynthesis', timeoutMs: getPhaseTimeoutMs('finalSynthesis') }
    );
    llmOutput = synthesisResult as FinalSynthesisAgentOutput;

    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_SUCCESS', {
      usage,
      outputSummary: {
        reportOutlineLength: llmOutput.reportOutline?.length || 0,
        finalDocumentLength: llmOutput.finalDocument.length,
      },
    });
  } catch (error) {
    llmError = error;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_ERROR', {
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    throw new Error(
      `[${TOOL_NAME}] Final synthesis LLM call failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  logger?.logToolCallEnd(TOOL_NAME, llmOutput, llmError);
  return llmOutput as FinalSynthesisAgentOutput;
}



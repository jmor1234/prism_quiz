import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { SQAInput, SQAOutput } from './types';
import { sqaAssessmentSchema, SqaAssessment } from './schema';
import { getSignalQualityAssessmentPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const SQA_AGENT_TOOL_NAME = 'signalQualityAssessmentAgent';
const LLM_MODEL_NAME = 'gemini-2.5-flash-lite';

export async function assessSignalQuality(input: SQAInput): Promise<SQAOutput> {
  const logger = getLogger();
  logger?.logToolCallStart(SQA_AGENT_TOOL_NAME, {
    url: input.url,
    focusedObjective: input.focusedObjective,
    title: input.title,
  });

  let assessmentResult: SqaAssessment | null = null;
  let llmError: unknown = null;

  try {
    logger?.logToolInternalStep(SQA_AGENT_TOOL_NAME, 'LLM_CALL_START', {
      model: LLM_MODEL_NAME,
      fullTextLength: input.fullText.length,
    });

    const { object: assessmentData, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: google(LLM_MODEL_NAME),
          schema: sqaAssessmentSchema,
          prompt: getSignalQualityAssessmentPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'sqa', timeoutMs: getPhaseTimeoutMs('sqa') }
    );
    assessmentResult = assessmentData as SqaAssessment;

    logger?.logToolInternalStep(SQA_AGENT_TOOL_NAME, 'LLM_CALL_SUCCESS', {
      usage,
      url: input.url,
    });
    console.log(`[${SQA_AGENT_TOOL_NAME}] Assessing URL: ${input.url} for objective: ${input.focusedObjective}`);
    console.log(`[${SQA_AGENT_TOOL_NAME}] Calling LLM (${LLM_MODEL_NAME}) for URL: ${input.url} with ${input.fullText.length} characters of text`);
    console.log(`[${SQA_AGENT_TOOL_NAME}] LLM assessment received for URL: ${input.url}. 📊 Tokens: ${usage.inputTokens?.toLocaleString?.() ?? 'n/a'} in / ${usage.outputTokens?.toLocaleString?.() ?? 'n/a'} out / ${(usage.totalTokens as number | undefined) ?? 'n/a'} total`);
  } catch (error) {
    llmError = error;
    logger?.logToolInternalStep(SQA_AGENT_TOOL_NAME, 'LLM_CALL_ERROR', {
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
      url: input.url,
    });
    throw new Error(
      `[${SQA_AGENT_TOOL_NAME}] SQA LLM assessment failed for URL ${input.url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (!assessmentResult) {
    throw new Error(`[${SQA_AGENT_TOOL_NAME}] Null assessment for URL: ${input.url}`);
  }

  const finalOutput: SQAOutput = {
    url: input.url,
    title: input.title,
    isHighSignal: assessmentResult.isHighSignal,
    rationale: assessmentResult.rationale,
    focusedObjective: input.focusedObjective,
    publishedDate: input.publishedDate,
    fullText: input.fullText,
  };

  logger?.logToolCallEnd(SQA_AGENT_TOOL_NAME, finalOutput, llmError);
  console.log(`[${SQA_AGENT_TOOL_NAME}] Assessment complete for URL: ${input.url} - ${finalOutput.isHighSignal ? 'HIGH SIGNAL' : 'LOW SIGNAL'}`);
  return finalOutput;
}



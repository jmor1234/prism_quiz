import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { ContentAnalysisAgentInput, ContentAnalysisAgentOutput, AnalyzedDocument } from './types';
import { contentAnalysisAgentOutputSchema } from './schema';
import { getContentAnalysisPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'contentAnalysisAgent';
const LLM_MODEL_NAME = 'gemini-2.5-flash-lite-preview-09-2025';

export async function analyzeDocument(input: ContentAnalysisAgentInput): Promise<AnalyzedDocument> {
  const logger = getLogger();
  const { url, focusedObjective } = input;

  logger?.logToolCallStart(TOOL_NAME, {
    url,
    focusedObjective,
    documentPublishedDate: input.documentPublishedDate,
    fullTextLength: input.fullText.length,
  });

  let llmOutput: ContentAnalysisAgentOutput | null = null;
  let llmError: unknown = null;

  try {
    console.log(`[${TOOL_NAME}] Calling LLM (${LLM_MODEL_NAME}) for URL: ${url}`);
    const { object: rawAnalysisResult, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: google(LLM_MODEL_NAME),
          schema: contentAnalysisAgentOutputSchema,
          prompt: getContentAnalysisPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'contentAnalysis', timeoutMs: getPhaseTimeoutMs('contentAnalysis') }
    );

    llmOutput = rawAnalysisResult as ContentAnalysisAgentOutput;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_SUCCESS', {
      url,
      usage,
      assessmentSummary: {
        findingsCount: llmOutput.findings?.length || 0,
        newEntitiesCount: llmOutput.newlyIdentifiedRelevantEntities?.length || 0,
        summaryLength: llmOutput.summaryOfAnalysis.length,
      },
    });
    console.log(`[${TOOL_NAME}] LLM assessment received for URL: ${url}. 📊 Tokens: ${usage.inputTokens?.toLocaleString?.() ?? 'n/a'} in / ${usage.outputTokens?.toLocaleString?.() ?? 'n/a'} out / ${(usage.totalTokens as number | undefined) ?? 'n/a'} total`);
  } catch (error) {
    llmError = error;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_ERROR', {
      url,
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    throw new Error(
      `[${TOOL_NAME}] Content analysis LLM failed for URL ${url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const finalAnalyzedDocument: AnalyzedDocument = {
    ...llmOutput!,
    url: input.url,
    focusedObjective: input.focusedObjective,
    documentPublishedDate: input.documentPublishedDate,
  };

  logger?.logToolCallEnd(TOOL_NAME, finalAnalyzedDocument, llmError);
  console.log(`[${TOOL_NAME}] Analysis complete for URL: ${url}`);
  return finalAnalyzedDocument;
}



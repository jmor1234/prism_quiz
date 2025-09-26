import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { ResearchConsolidationAgentInput } from './types';
import { consolidatedDocumentSchema, ConsolidatedDocument } from './schema';
import { getResearchConsolidationPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'researchConsolidationAgent';
const LLM_MODEL_NAME = 'gemini-2.5-flash-lite-preview-09-2025';

export async function consolidateDocument(
  input: ResearchConsolidationAgentInput
): Promise<ConsolidatedDocument> {
  const logger = getLogger();
  const { analyzedDocument, focusedObjective } = input;

  logger?.logToolCallStart(TOOL_NAME, {
    url: analyzedDocument.url,
    focusedObjective,
    originalFindingsCount: analyzedDocument.findings?.length || 0,
    originalEntitiesCount:
      analyzedDocument.newlyIdentifiedRelevantEntities?.length || 0,
  });

  let llmOutput: ConsolidatedDocument | null = null;
  let llmError: unknown = null;

  try {
    console.log(`[${TOOL_NAME}] Consolidating document: ${analyzedDocument.url}`);
    const { object: consolidatedResult, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: google(LLM_MODEL_NAME),
          schema: consolidatedDocumentSchema,
          prompt: getResearchConsolidationPrompt(input),
          abortSignal: signal,
        }),
      { phase: 'consolidation', timeoutMs: getPhaseTimeoutMs('consolidation') }
    );

    llmOutput = consolidatedResult as ConsolidatedDocument;

    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_SUCCESS', {
      url: analyzedDocument.url,
      usage,
      consolidationSummary: {
        essentialFindingsCount: llmOutput.essentialFindings.length,
        primaryContributionLength: llmOutput.primaryContribution.length,
      },
    });
    console.log(`[${TOOL_NAME}] Successfully consolidated document: ${analyzedDocument.url}. 📊 Tokens: ${usage.inputTokens?.toLocaleString?.() ?? 'n/a'} in / ${usage.outputTokens?.toLocaleString?.() ?? 'n/a'} out / ${(usage.totalTokens as number | undefined) ?? 'n/a'} total`);
  } catch (error) {
    llmError = error;
    logger?.logToolInternalStep(TOOL_NAME, 'LLM_CALL_ERROR', {
      url: analyzedDocument.url,
      error: error instanceof Error ? { message: error.message, name: error.name } : String(error),
    });
    throw new Error(
      `[${TOOL_NAME}] Document consolidation failed for URL ${analyzedDocument.url}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  logger?.logToolCallEnd(TOOL_NAME, llmOutput, llmError);
  console.log(`[${TOOL_NAME}] Consolidation complete for URL: ${analyzedDocument.url}`);
  return llmOutput as ConsolidatedDocument;
}



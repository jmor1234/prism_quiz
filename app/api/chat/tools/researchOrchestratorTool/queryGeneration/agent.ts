import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getLogger } from '@/app/api/chat/lib/traceLogger';
import { QueryGenerationPromptInput } from './types';
import { queryGenerationOutputSchema, QueryGenerationOutput } from './schema';
import { getQueryGenerationPrompt } from './prompt';
import { withRetry } from '@/app/api/chat/lib/llmRetry';
import { getPhaseTimeoutMs } from '@/app/api/chat/lib/retryConfig';

const TOOL_NAME = 'queryGenerationTool';

export async function generateQueriesForObjective(
  input: QueryGenerationPromptInput
): Promise<QueryGenerationOutput> {
  const logger = getLogger();
  logger?.logToolCallStart(TOOL_NAME, {
    focusedObjective: input.focusedObjective,
  });

  let error: unknown = null;
  let queryResult: QueryGenerationOutput | null = null;

  try {
    const currentDate =
      input.currentDate ||
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    const inputWithDefaults: QueryGenerationPromptInput = {
      ...input,
      currentDate,
    };

    console.log(`
### Executing ${TOOL_NAME} ###
Focused Objective: ${input.focusedObjective}
Focus Areas: ${input.focusAreas.length} areas defined
`);

    const { object: result, usage } = await withRetry(
      (signal) =>
        generateObject({
          model: google('gemini-2.5-flash-lite-preview-09-2025'),
          schema: queryGenerationOutputSchema,
          prompt: getQueryGenerationPrompt(inputWithDefaults),
          abortSignal: signal,
        }),
      { phase: 'queryGen', timeoutMs: getPhaseTimeoutMs('queryGen') }
    );

    queryResult = result as QueryGenerationOutput;
    logger?.logToolInternalStep(TOOL_NAME, 'GENERATE_QUERIES_SUCCESS', {
      keywordQueryCount: queryResult.keywordQueries.length,
      neuralQueryCount: queryResult.neuralQueries.length,
      usage,
    });

    console.log(`   [${TOOL_NAME}] Successfully generated queries. 📊 Tokens: ${usage.inputTokens?.toLocaleString?.() ?? 'n/a'} in / ${usage.outputTokens?.toLocaleString?.() ?? 'n/a'} out / ${(usage.totalTokens as number | undefined) ?? 'n/a'} total`);
    console.log(`   - Keyword Queries: ${queryResult.keywordQueries.length}`);
    console.log(`   - Neural Queries: ${queryResult.neuralQueries.length}`);

    if (queryResult.keywordQueries.length > 0) {
      console.log(`   - Keyword Queries:`);
      queryResult.keywordQueries.forEach((query, index) => {
        console.log(`     ${index + 1}. "${query}"`);
      });
    }
    if (queryResult.neuralQueries.length > 0) {
      console.log(`   - Neural Queries:`);
      queryResult.neuralQueries.forEach((query, index) => {
        console.log(`     ${index + 1}. "${query}"`);
      });
    }
  } catch (e) {
    error = e;
    logger?.logToolInternalStep(TOOL_NAME, 'GENERATE_QUERIES_ERROR', {
      error:
        e instanceof Error
          ? { message: e.message, name: e.name, stack: e.stack?.substring(0, 200) }
          : String(e),
    });
    throw new Error(
      `Query generation failed: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    logger?.logToolCallEnd(TOOL_NAME, queryResult, error);
  }

  console.log(`### ${TOOL_NAME} Execution Finished ###\n`);
  return queryResult as QueryGenerationOutput;
}



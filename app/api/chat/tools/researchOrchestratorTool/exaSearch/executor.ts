import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { ResearchPlan } from "../researchStrategy/schema";
import { defaultExaSearchOptions, CONCURRENT_EXA_CALLS_LIMIT, DELAY_BETWEEN_CONCURRENT_BATCHES_MS } from "./constants";
import { searchExa } from "./exaClient";
import { ExaSearchConfig, SingleExaQueryOutcome, ExaSearchHit, ExaCategory } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ExaExecutionTask {
  focusedObjective: string;
  originalQuery: string;
  queryType: 'keyword' | 'neural';
  recommendedCategory?: ExaCategory;
  timeContext?: ResearchPlan['timeContext'];
}

export async function orchestrateInitialExaSearch({
  generatedQueries,
  researchPlan,
}: {
  generatedQueries: { keywordQueries: string[]; neuralQueries: string[] };
  researchPlan: ResearchPlan;
}): Promise<SingleExaQueryOutcome[]> {
  const logger = getLogger();
  const allQueryOutcomes: SingleExaQueryOutcome[] = [];
  const phaseName = 'ExaInitialSearchPhase';

  logger?.logToolInternalStep('ResearchOrchestrator', `START_${phaseName.toUpperCase()}`, {
    researchMainObjective: researchPlan.focusedObjective,
    keywordQueriesCount: generatedQueries.keywordQueries.length,
    neuralQueriesCount: generatedQueries.neuralQueries.length,
    concurrencyLimit: CONCURRENT_EXA_CALLS_LIMIT,
  });
  console.log(`\n🔄 [ResearchOrchestrator] Starting ${phaseName} for research objective. Concurrency: ${CONCURRENT_EXA_CALLS_LIMIT} calls per batch.`);

  const allTasksToExecute: ExaExecutionTask[] = [];
  const taskBase = {
    focusedObjective: researchPlan.focusedObjective,
    recommendedCategory: researchPlan.recommendedCategories?.[0],
    timeContext: researchPlan.timeContext,
  };

  generatedQueries.keywordQueries.forEach((q) =>
    allTasksToExecute.push({ ...taskBase, originalQuery: q, queryType: 'keyword' })
  );
  generatedQueries.neuralQueries.forEach((q) =>
    allTasksToExecute.push({ ...taskBase, originalQuery: q, queryType: 'neural' })
  );
  console.log(`  ➡️ Total queries to execute: ${allTasksToExecute.length} (${generatedQueries.keywordQueries.length} keyword, ${generatedQueries.neuralQueries.length} neural)`);

  for (let i = 0; i < allTasksToExecute.length; i += CONCURRENT_EXA_CALLS_LIMIT) {
    const chunk = allTasksToExecute.slice(i, i + CONCURRENT_EXA_CALLS_LIMIT);
    console.log(`    🌀 [${phaseName}] Processing chunk ${Math.floor(i / CONCURRENT_EXA_CALLS_LIMIT) + 1} of ${Math.ceil(allTasksToExecute.length / CONCURRENT_EXA_CALLS_LIMIT)}. Chunk size: ${chunk.length}`);
    const promisesInChunk = chunk.map(async (task) => {
      const currentExaConfig: ExaSearchConfig = {
        query: task.originalQuery,
        type: task.queryType,
        numResults: defaultExaSearchOptions.numResults,
        category: task.recommendedCategory,
        startPublishedDate: task.timeContext?.startDate,
        endPublishedDate: task.timeContext?.endDate,
      };

      logger?.logToolInternalStep('ResearchOrchestrator', 'PREPARE_EXA_CALL', {
        focusedObjective: task.focusedObjective,
        query: task.originalQuery,
        queryType: task.queryType,
        config: currentExaConfig,
      });
      console.log(`      🚀 [${phaseName}] Preparing ${task.queryType} query: "${task.originalQuery}"`);

      try {
        const useAutopromptFlag = task.queryType === 'neural';
        const results: ExaSearchHit[] = await searchExa(currentExaConfig, useAutopromptFlag);
        logger?.logToolInternalStep('ResearchOrchestrator', 'EXA_API_CALL_SUCCESS', {
          focusedObjective: task.focusedObjective,
          query: task.originalQuery,
          queryType: task.queryType,
          resultsCount: results.length,
        });
        console.log(`      ✅ [${phaseName}] SUCCESS for ${task.queryType} query "${task.originalQuery}". Got ${results.length} results.`);

        return {
          focusedObjective: task.focusedObjective,
          originalQuery: task.originalQuery,
          queryType: task.queryType,
          configUsed: currentExaConfig,
          success: true,
          results,
        } satisfies SingleExaQueryOutcome;
      } catch (error: unknown) {
        const e = error instanceof Error ? error : new Error(String(error));
        logger?.logToolInternalStep('ResearchOrchestrator', 'EXA_API_CALL_ERROR', {
          focusedObjective: task.focusedObjective,
          query: task.originalQuery,
          queryType: task.queryType,
          error: { message: e.message, name: e.name, stack: e.stack?.substring(0, 200) },
        });
        console.error(`      ❌ [${phaseName}] ERROR for ${task.queryType} query "${task.originalQuery}":`, e.message);
        return {
          focusedObjective: task.focusedObjective,
          originalQuery: task.originalQuery,
          queryType: task.queryType,
          configUsed: currentExaConfig,
          success: false,
          error: { message: e.message, name: e.name, details: error },
        } satisfies SingleExaQueryOutcome;
      }
    });

    const chunkOutcomes = await Promise.all(promisesInChunk);
    allQueryOutcomes.push(...chunkOutcomes);

    if (i + CONCURRENT_EXA_CALLS_LIMIT < allTasksToExecute.length) {
      console.log(`    ⏱️ [${phaseName}] Batch of ${chunk.length} calls processed. Waiting ${DELAY_BETWEEN_CONCURRENT_BATCHES_MS}ms before next batch...`);
      await delay(DELAY_BETWEEN_CONCURRENT_BATCHES_MS);
    }
  }

  logger?.logToolInternalStep('ResearchOrchestrator', `END_${phaseName.toUpperCase()}`, {
    totalQueriesAttempted: allQueryOutcomes.length,
    successfulQueries: allQueryOutcomes.filter((o) => o.success).length,
    totalBatches: Math.ceil(allTasksToExecute.length / CONCURRENT_EXA_CALLS_LIMIT),
  });
  console.log(`\n🏁 [ResearchOrchestrator] ${phaseName} completed. Processed ${allTasksToExecute.length} queries in ${Math.ceil(allTasksToExecute.length / CONCURRENT_EXA_CALLS_LIMIT)} batches.`);

  return allQueryOutcomes;
}



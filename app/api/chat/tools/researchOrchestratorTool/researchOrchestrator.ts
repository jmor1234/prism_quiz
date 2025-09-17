import { getLogger } from "@/app/api/chat/lib/traceLogger";
import type { ResearchPlan } from "./researchStrategy/schema";
import { generateQueriesForObjective } from "./queryGeneration/agent";
import type { QueryGenerationOutput } from "./queryGeneration/schema";
import { orchestrateInitialExaSearch } from "./exaSearch/executor";
import type { SingleExaQueryOutcome } from "./exaSearch/types";
import { fetchFullTextContents } from "./exaSearch/exaClient";
import { assessSignalQuality } from "./signalQualityAssessment/agent";
import type { SQAInput, SQAOutput } from "./signalQualityAssessment/types";
import { analyzeDocument } from "./contentAnalysis/agent";
import type { ContentAnalysisAgentInput, AnalyzedDocument } from "./contentAnalysis/types";
import { CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT, DELAY_BETWEEN_CONTENT_ANALYSIS_BATCHES_MS } from "./contentAnalysis/constants";
import { consolidateDocument } from "./researchConsolidation/agent";
import type { ResearchConsolidationAgentInput } from "./researchConsolidation/types";
import type { ConsolidatedDocument } from "./researchConsolidation/schema";
import { generateFinalReport } from "./finalSynthesis/agent";
import type { FinalSynthesisAgentOutput } from "./finalSynthesis/schema";

// Safe, deterministic URL canonicalization for dedup/citations
function canonicalizeUrlForDedup(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    // Lowercase host; keep scheme as-is (do not force https)
    u.hostname = u.hostname.toLowerCase();
    // Remove default ports
    if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }
    // Remove fragments
    u.hash = '';
    // Remove common tracking params
    const trackingParams = new Set([
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'gclid','fbclid','ref','ref_src','mc_eid','xtor'
    ]);
    const params = u.searchParams;
    for (const p of Array.from(params.keys())) {
      if (trackingParams.has(p)) params.delete(p);
    }
    // Collapse multiple slashes in path (except leading)
    u.pathname = u.pathname.replace(/\/+/, '/');
    // Remove trailing slash if not root
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// (removed stats helpers to align with previous logging style)

// Placeholders for types imported from submodules that will be implemented in later phases
// (Removed placeholder FinalSynthesisAgentOutput interface; using imported type)

export interface ResearchExecutionResult {
  researchPlan: ResearchPlan;
  finalSynthesisReport: FinalSynthesisAgentOutput;
}

// Orchestration phases to be implemented in subsequent phases
export async function orchestrateResearchExecution(
  researchPlan: ResearchPlan,
  currentDate: string,
  executionIndex?: number
): Promise<ResearchExecutionResult> {
  const logger = getLogger();
  logger?.logToolInternalStep("ResearchOrchestrator", "START_RESEARCH_EXECUTION_PIPELINE", {
    researchPlanObjective: researchPlan.focusedObjective,
    focusAreasCount: researchPlan.focusAreas.length,
  });

  // Phase 1: Query Generation
  logger?.startLogSection('query_generation_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Generating queries for focused objective: "${researchPlan.focusedObjective.substring(0, 70)}..."`);
  const generatedQueries: QueryGenerationOutput = await generateQueriesForObjective({
    focusedObjective: researchPlan.focusedObjective,
    focusAreas: researchPlan.focusAreas,
    keyEntities: researchPlan.keyEntities,
    currentDate,
    recommendedCategories: researchPlan.recommendedCategories,
    timeConstraints: researchPlan.timeContext
      ? {
          startDate: researchPlan.timeContext.startDate,
          endDate: researchPlan.timeContext.endDate,
          recencyRequired: researchPlan.timeContext.recencyRequired,
        }
      : undefined,
  });

  if (!generatedQueries || (generatedQueries.keywordQueries.length === 0 && generatedQueries.neuralQueries.length === 0)) {
    logger?.logToolInternalStep('ResearchOrchestrator', 'EMPTY_QUERY_GENERATION', {});
    throw new Error('No queries generated for the research objective');
  }
  // (summary logs removed to match prior logging style)

  // Phase 2: Initial Exa Search
  logger?.startLogSection('exa_initial_search_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting ExaInitialSearchPhase for research objective. Concurrency: ${CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT} calls per batch.`);
  const exaSearchOutcomes: SingleExaQueryOutcome[] = await orchestrateInitialExaSearch({
    generatedQueries,
    researchPlan,
  });
  // (summary logs removed to match prior logging style)

  // Phase 2.5: Deduplicate URLs (canonicalize for key, preserve original for fetch)
  logger?.startLogSection('url_deduplication_phase', executionIndex);
  const urlMap = new Map<string, { canonicalUrl: string; originalUrl: string; title?: string | null; publishedDate?: string }>();
  let totalUrls = 0;
  for (const outcome of exaSearchOutcomes) {
    if (outcome.success && outcome.results) {
      for (const hit of outcome.results) {
        if (!hit.url) continue;
        totalUrls += 1;
        const key = canonicalizeUrlForDedup(hit.url);
        if (!urlMap.has(key)) {
          urlMap.set(key, { canonicalUrl: key, originalUrl: hit.url, title: hit.title, publishedDate: hit.publishedDate });
        } else {
          const existing = urlMap.get(key)!;
          if (hit.publishedDate && (!existing.publishedDate || hit.publishedDate > existing.publishedDate)) {
            existing.publishedDate = hit.publishedDate;
          }
          if (!existing.title && hit.title) {
            existing.title = hit.title;
          }
          // Prefer the shorter original URL for display/fetch if available
          if (hit.url.length < existing.originalUrl.length) {
            existing.originalUrl = hit.url;
          }
        }
      }
    }
  }
  const deduplicated = Array.from(urlMap.values());
  console.log(`🔄 [ResearchOrchestrator] URL Deduplication complete. ${deduplicated.length} unique URLs from ${totalUrls} total results.`);
  // (summary logs removed to match prior logging style)

  if (deduplicated.length === 0) {
    throw new Error('No URLs remaining after deduplication');
  }

  // Phase 2.6: Retrieve full text contents in batch
  logger?.startLogSection('initial_full_text_retrieval_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting InitialFullTextRetrievalPhase for ${deduplicated.length} unique URLs...`);
  const contentResults = await fetchFullTextContents(deduplicated.map((d) => d.originalUrl));
  const urlsWithFullText = contentResults.map((r) => {
    // Map by original URL; find its canonical record
    // Build a reverse index on first access
    const metaEntry = (() => {
      for (const v of urlMap.values()) {
        if (v.originalUrl === r.url) return v;
      }
      return undefined;
    })();
    const meta = metaEntry;
    return {
      url: meta?.canonicalUrl || r.url,
      title: meta?.title,
      publishedDate: meta?.publishedDate,
      fullText: r.fullText,
      retrievalSuccess: r.success,
    };
  });

  const validContent = urlsWithFullText.filter((u) => u.retrievalSuccess && u.fullText && u.fullText.trim() !== '');
  if (validContent.length === 0) {
    throw new Error('Failed to retrieve valid content from any URLs');
  }
  // Per-URL retrieval outcome (console narrative as in original tool)
  urlsWithFullText.forEach((item) => {
    if (item.retrievalSuccess) {
      console.log(`     - ${item.url} (retrieved ${item.fullText?.length ?? 0} chars)`);
    } else {
      console.log(`     - ${item.url} (failed to retrieve content)`);
    }
  });
  const successCount = validContent.length;
  const failureCount = urlsWithFullText.length - successCount;
  console.log(`✅ [ResearchOrchestrator] InitialFullTextRetrievalPhase complete. Successfully retrieved ${successCount}/${urlsWithFullText.length} documents.`);
  if (failureCount > 0) {
    console.log(`⚠️  [ResearchOrchestrator] Failed to retrieve content for ${failureCount} URLs.`);
  }
  // (summary logs removed to match prior logging style)

  // Phase 3: SQA on full text (batched)
  logger?.startLogSection('sqa_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting FullTextSignalQualityAssessmentPhase for ${validContent.length} URLs with valid content...`);
  const sqaInputs: SQAInput[] = validContent.map((it) => ({
    url: it.url,
    fullText: it.fullText!,
    title: it.title,
    focusedObjective: researchPlan.focusedObjective,
    focusAreas: researchPlan.focusAreas,
    keyEntities: researchPlan.keyEntities,
    publishedDate: it.publishedDate,
    currentDate,
  }));

  const allSqa: SQAOutput[] = [];
  const BATCH = 100;
  for (let i = 0; i < sqaInputs.length; i += BATCH) {
    const batch = sqaInputs.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((inp) => assessSignalQuality(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) allSqa.push(r);
    });
  }

  const highSignal = allSqa.filter((o) => o.isHighSignal);
  if (highSignal.length === 0) {
    throw new Error('No high-signal URLs identified from search results');
  }
  console.log(`\n🏁 [ResearchOrchestrator] FullTextSignalQualityAssessmentPhase completed. Identified ${highSignal.length} high-signal URLs out of ${allSqa.length} assessed.`);
  // (summary logs removed to match prior logging style)

  // Phase 4: Content Analysis (batched)
  logger?.startLogSection('content_analysis_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting ContentAnalysisPhase for ${highSignal.length} documents.`);
  const analysisInputs: ContentAnalysisAgentInput[] = highSignal.map((h) => ({
    url: h.url,
    fullText: h.fullText,
    focusedObjective: researchPlan.focusedObjective,
    focusAreas: researchPlan.focusAreas,
    keyEntities: researchPlan.keyEntities,
    documentPublishedDate: h.publishedDate,
    currentDate,
  }));
  const analyzedDocuments: AnalyzedDocument[] = [];
  for (let i = 0; i < analysisInputs.length; i += CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT) {
    const batch = analysisInputs.slice(i, i + CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT);
    console.log(`  🌀 [ContentAnalysisPhase] Processing batch ${Math.floor(i / CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT) + 1}/${Math.ceil(analysisInputs.length / CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT)}. Analyzing ${batch.length} documents.`);
    const results = await Promise.all(
      batch.map((inp) => analyzeDocument(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) analyzedDocuments.push(r);
    });
    if (i + CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT < analysisInputs.length && DELAY_BETWEEN_CONTENT_ANALYSIS_BATCHES_MS > 0) {
      console.log(`    ⏱️ [ContentAnalysisPhase] Batch ${Math.floor(i / CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT) + 1} processed. Waiting ${DELAY_BETWEEN_CONTENT_ANALYSIS_BATCHES_MS}ms...`);
      await new Promise((res) => setTimeout(res, DELAY_BETWEEN_CONTENT_ANALYSIS_BATCHES_MS));
    }
  }
  if (analyzedDocuments.length === 0) {
    throw new Error('Failed to analyze any documents');
  }
  // (summary logs removed to match prior logging style)

  // Phase 6.5: Research Consolidation (batched)
  logger?.startLogSection('research_consolidation_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting ResearchConsolidationPhase for ${analyzedDocuments.length} documents.`);
  const consolidationInputs: ResearchConsolidationAgentInput[] = analyzedDocuments.map((doc) => ({
    analyzedDocument: doc,
    focusedObjective: researchPlan.focusedObjective,
    focusAreas: researchPlan.focusAreas,
    keyEntities: researchPlan.keyEntities,
    currentDate,
  }));
  const consolidatedDocuments: ConsolidatedDocument[] = [];
  const CONS_BATCH = 100;
  for (let i = 0; i < consolidationInputs.length; i += CONS_BATCH) {
    const batch = consolidationInputs.slice(i, i + CONS_BATCH);
    console.log(`  🌀 [ResearchConsolidationPhase] Processing batch ${Math.floor(i / 100) + 1}/${Math.ceil(consolidationInputs.length / 100)}. Consolidating ${batch.length} documents.`);
    const results = await Promise.all(
      batch.map((inp) => consolidateDocument(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) consolidatedDocuments.push(r);
    });
    if (i + CONS_BATCH < consolidationInputs.length) {
      console.log(`    ⏱️ [ResearchConsolidationPhase] Batch ${Math.floor(i / 100) + 1} processed. Waiting 50ms...`);
      await new Promise((res) => setTimeout(res, 50));
    }
  }
  if (consolidatedDocuments.length === 0) {
    throw new Error('Failed to consolidate any documents');
  }

  logger?.logToolInternalStep('ResearchOrchestrator', 'CONTENT_PROCESSING_COMPLETED', {
    analyzedDocsCount: analyzedDocuments.length,
    consolidatedDocsCount: consolidatedDocuments.length,
  });
  // (summary logs removed to match prior logging style)

  // Phase 7: Final Synthesis
  logger?.startLogSection('final_synthesis_phase', executionIndex);
  console.log(`🔄 [ResearchOrchestrator] Starting Final Synthesis Phase with ${consolidatedDocuments.length} consolidated documents...`);
  const finalReportOutput: FinalSynthesisAgentOutput = await generateFinalReport({
    consolidatedDocuments,
    researchPlan,
    currentDate,
  });
  console.log(`🏁 [ResearchOrchestrator] Research execution pipeline completed. Analyzed ${analyzedDocuments.length} documents, consolidated to ${consolidatedDocuments.length}.`);
  // (summary logs removed to match prior logging style)

  return {
    researchPlan,
    finalSynthesisReport: {
      thinking: finalReportOutput.thinking,
      finalDocument: finalReportOutput.finalDocument,
    },
  };
}



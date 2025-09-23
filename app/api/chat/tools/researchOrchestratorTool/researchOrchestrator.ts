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
import type { FinalSynthesisAgentOutput } from "./finalSynthesis/types";
import { generateMergedFinalReport } from './finalSynthesisReducer/agent';

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

// Map-Reduce Final Synthesis configuration (no envs; change here if needed)
const FINAL_SYNTHESIS_PARTITION_TRIGGER = 15;
const FINAL_SYNTHESIS_MAX_GROUP_SIZE = 15; // ensure each group ≤ 10 documents

// Orchestration phases to be implemented in subsequent phases
export async function orchestrateResearchExecution(
  researchPlan: ResearchPlan,
  currentDate: string,
  executionIndex?: number,
  objectiveId?: string
): Promise<ResearchExecutionResult> {
  const logger = getLogger();
  logger?.logToolInternalStep("ResearchOrchestrator", "START_RESEARCH_EXECUTION_PIPELINE", {
    researchPlanObjective: researchPlan.focusedObjective,
    focusAreasCount: researchPlan.focusAreas.length,
  });

  // Helper function to emit phase progress
  const emitPhaseProgress = (phase: string, status: 'starting' | 'active' | 'complete' | 'error', progress: number, details?: unknown) => {
    if (!objectiveId) return;
    const phaseId = `${objectiveId}-${phase}`;
    logger?.emitPhaseProgress(phaseId, {
      objective: researchPlan.focusedObjective,
      phase,
      status,
      progress,
      details: details as {
        current?: number; total?: number; description?: string;
        samples?: { url: string; title?: string; domain?: string }[];
        summary?: { queries: number; hits?: number; unique?: number };
        queries?: string[];
        subphase?: 'retrieval' | 'sqa' | 'analysis' | 'consolidation';
        metrics?: {
          fetched?: { ok: number; total: number };
          highSignal?: { ok: number; total: number };
          analyzed?: { current: number; total: number };
          consolidated?: { current: number; total: number };
        };
      },
    });

    // Also update objective progress
    logger?.emitObjectiveProgress(objectiveId, {
      objective: researchPlan.focusedObjective,
      status: 'active',
      phase: phase as "query-generation" | "searching" | "deduplicating" | "analyzing" | "consolidating" | "synthesizing",
      progress,
      focusAreas: researchPlan.focusAreas,
      keyEntities: researchPlan.keyEntities,
      categories: (researchPlan.recommendedCategories as string[]) || [],
    });
  };

  // Phase 1: Query Generation
  logger?.startLogSection('query_generation_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Generating queries for focused objective: "${researchPlan.focusedObjective.substring(0, 70)}..."`);
  emitPhaseProgress('query-generation', 'starting', 0.1);
  logger?.emitOperation('Generating search queries...', { phase: 'query-generation', objective: researchPlan.focusedObjective });

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
    emitPhaseProgress('query-generation', 'error', 0.1);
    throw new Error('No queries generated for the research objective');
  }
  // Emit full query list for Details view; UI will cap display in Pipeline
  const totalQueries = generatedQueries.keywordQueries.length + generatedQueries.neuralQueries.length;
  const allQueries: string[] = [
    ...generatedQueries.keywordQueries,
    ...generatedQueries.neuralQueries,
  ];
  emitPhaseProgress('query-generation', 'complete', 0.2, {
    description: `Generated ${totalQueries} search queries`,
    queries: allQueries,
  });
  logger?.emitOperation(`Generated ${totalQueries} search queries`, { phase: 'query-generation' });

  // Phase 2: Initial Exa Search
  logger?.startLogSection('exa_initial_search_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting ExaInitialSearchPhase for research objective. Concurrency: ${CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT} calls per batch.`);
  emitPhaseProgress('searching', 'starting', 0.2);
  logger?.emitOperation(`Searching ${totalQueries} queries...`, { phase: 'searching', objective: researchPlan.focusedObjective });

  const exaSearchOutcomes: SingleExaQueryOutcome[] = await orchestrateInitialExaSearch({
    generatedQueries,
    researchPlan,
  });
  // (summary logs removed to match prior logging style)

  // Emit searching complete with sample domains for UI
  {
    const domains = new Set<string>();
    const samples: { url: string; title?: string; domain?: string }[] = [];
    for (const outcome of exaSearchOutcomes) {
      if (!outcome.success || !outcome.results) continue;
      for (const hit of outcome.results) {
        try {
          const d = new URL(hit.url).hostname.replace(/^www\./, '');
          if (!domains.has(d)) {
            domains.add(d);
            samples.push({ url: hit.url, title: hit.title ?? undefined, domain: d });
            if (samples.length >= 8) break;
          }
        } catch {}
      }
      if (samples.length >= 8) break;
    }
    // Compute summary counts for UI chips
    let hits = 0;
    const uniqueKeys = new Set<string>();
    for (const outcome of exaSearchOutcomes) {
      if (outcome.success && outcome.results) {
        hits += outcome.results.length;
        for (const r of outcome.results) {
          try { uniqueKeys.add(canonicalizeUrlForDedup(r.url)); } catch {}
        }
      }
    }
    emitPhaseProgress('searching', 'complete', 0.3, {
      description: 'Search completed',
      samples,
      summary: { queries: totalQueries, hits, unique: uniqueKeys.size }
    });

    // Stream a capped collection of search hits (replace semantics)
    const topHits = [] as { url: string; title?: string; domain?: string }[];
    for (const outcome of exaSearchOutcomes) {
      if (!outcome.success || !outcome.results) continue;
      for (const hit of outcome.results) {
        try {
          const d = new URL(hit.url).hostname.replace(/^www\./, '');
          topHits.push({ url: hit.url, title: hit.title ?? undefined, domain: d });
          if (topHits.length >= 50) break;
        } catch {}
      }
      if (topHits.length >= 50) break;
    }
    logger?.emitCollectionUpdate(`${objectiveId}-search-hits`, {
      kind: 'search_hits', action: 'replace', total: hits, items: topHits,
    });
    // Seed Sources tab with earliest sample domains
    logger?.emitSources(objectiveId, { items: samples });
  }
  logger?.emitOperation(`Search completed, processing results...`, { phase: 'searching' });

  // Phase 2.5: Deduplicate URLs (canonicalize for key, preserve original for fetch)
  logger?.startLogSection('url_deduplication_phase', executionIndex);
  emitPhaseProgress('deduplicating', 'starting', 0.3);
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
  // Emit dedup completion with unique domain samples
  {
    const samples = deduplicated.slice(0, 8).map((d) => {
      let domain = '';
      try { domain = new URL(d.originalUrl).hostname.replace(/^www\./, ''); } catch {}
      return { url: d.originalUrl, title: d.title ?? undefined, domain } as { url: string; title?: string; domain?: string };
    });
    emitPhaseProgress('deduplicating', 'complete', 0.35, {
      description: `Deduplicated to ${deduplicated.length} unique URLs`,
      samples,
    });
    // Stream unique URL collection (replace; capped to 100)
    const uniqueItems = deduplicated.slice(0, 100).map((d) => {
      let domain = '';
      try { domain = new URL(d.originalUrl).hostname.replace(/^www\./, ''); } catch {}
      return { url: d.originalUrl, title: d.title ?? undefined, domain } as { url: string; title?: string; domain?: string };
    });
    logger?.emitCollectionUpdate(`${objectiveId}-unique-urls`, {
      kind: 'unique_urls', action: 'replace', total: deduplicated.length, items: uniqueItems,
    });
  }
  logger?.emitOperation(`Found ${deduplicated.length} unique URLs from ${totalUrls} results`, { phase: 'deduplicating' });

  if (deduplicated.length === 0) {
    emitPhaseProgress('deduplicating', 'error', 0.35);
    throw new Error('No URLs remaining after deduplication');
  }

  // Phase 2.6: Retrieve full text contents in batch
  logger?.startLogSection('initial_full_text_retrieval_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting InitialFullTextRetrievalPhase for ${deduplicated.length} unique URLs...`);
  emitPhaseProgress('analyzing', 'starting', 0.4);
  logger?.emitOperation(`Fetching full content for ${deduplicated.length} URLs...`, { phase: 'analyzing', objective: researchPlan.focusedObjective });

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
  // Update progress after fetching
  emitPhaseProgress('analyzing', 'active', 0.5, {
    description: `Fetched content from ${deduplicated.length} sources`,
    subphase: 'retrieval',
    metrics: { fetched: { ok: validContent.length, total: urlsWithFullText.length } },
  });
  // Stream retrieved collection (replace; cap 50)
  const retrievedItems = validContent
    .slice(0, 50)
    .map((u) => {
      let domain = '';
      try { domain = new URL(u.url).hostname.replace(/^www\./, ''); } catch {}
      return { url: u.url, title: u.title ?? undefined, domain } as { url: string; title?: string; domain?: string };
    });
  logger?.emitCollectionUpdate(`${objectiveId}-retrieved`, { kind: 'retrieved', action: 'replace', total: urlsWithFullText.length, items: retrievedItems });
  logger?.emitOperation(`Processing ${deduplicated.length} sources...`, { phase: 'analyzing' });
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

  // Update to signal quality assessment phase
  emitPhaseProgress('analyzing', 'active', 0.55, {
    description: `Assessing quality of ${validContent.length} sources`,
    subphase: 'sqa',
    samples: validContent.slice(0, 8).map((u) => {
      let domain = '';
      try { domain = new URL(u.url).hostname.replace(/^www\./, ''); } catch {}
      return { url: u.url, title: u.title, domain } as { url: string; title?: string; domain?: string };
    }),
    metrics: { highSignal: { ok: 0, total: validContent.length } },
  });
  logger?.emitOperation(`Assessing signal quality for ${validContent.length} sources...`, { phase: 'analyzing' });

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
    const batchNumber = Math.floor(i / BATCH) + 1;
    const totalBatches = Math.ceil(sqaInputs.length / BATCH);

    // Update progress for each batch
    logger?.emitOperation(`Assessing quality batch ${batchNumber}/${totalBatches}...`, { phase: 'analyzing' });

    const results = await Promise.all(
      batch.map((inp) => assessSignalQuality(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) allSqa.push(r);
    });

    // Update progress based on completion
    const progressIncrement = 0.55 + (0.1 * (i + batch.length) / sqaInputs.length);
    emitPhaseProgress('analyzing', 'active', progressIncrement);
  }

  const highSignal = allSqa.filter((o) => o.isHighSignal);
  // Stream high-signal collection (replace; cap 40)
  logger?.emitCollectionUpdate(`${objectiveId}-high-signal`, {
    kind: 'high_signal', action: 'replace', total: allSqa.length,
    items: highSignal.slice(0, 40).map((h) => { let domain = ''; try { domain = new URL(h.url).hostname.replace(/^www\./,''); } catch {} return { url: h.url, title: h.title ?? undefined, domain }; })
  });
  // Update analyzing metrics for high-signal snapshot
  emitPhaseProgress('analyzing', 'active', 0.6, {
    subphase: 'sqa',
    metrics: { highSignal: { ok: highSignal.length, total: allSqa.length } },
  });
  if (highSignal.length === 0) {
    throw new Error('No high-signal URLs identified from search results');
  }
  console.log(`\n🏁 [ResearchOrchestrator] FullTextSignalQualityAssessmentPhase completed. Identified ${highSignal.length} high-signal URLs out of ${allSqa.length} assessed.`);
  // (summary logs removed to match prior logging style)

  // Phase 4: Content Analysis (batched)
  logger?.startLogSection('content_analysis_phase', executionIndex);
  console.log(`\n🔄 [ResearchOrchestrator] Starting ContentAnalysisPhase for ${highSignal.length} documents.`);

  // Update to content analysis phase
  emitPhaseProgress('analyzing', 'active', 0.65, {
    description: `Analyzing ${highSignal.length} high-signal documents`,
    subphase: 'analysis',
    samples: highSignal.slice(0, 8).map((h) => {
      let domain = '';
      try { domain = new URL(h.url).hostname.replace(/^www\./, ''); } catch {}
      return { url: h.url, title: h.title, domain } as { url: string; title?: string; domain?: string };
    }),
    metrics: { analyzed: { current: 0, total: highSignal.length } },
  });
  logger?.emitOperation(`Deep analysis of ${highSignal.length} documents...`, { phase: 'analyzing' });
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
    const batchNumber = Math.floor(i / CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT) + 1;
    const totalBatches = Math.ceil(analysisInputs.length / CONCURRENT_CONTENT_ANALYSIS_CALLS_LIMIT);

    console.log(`  🌀 [ContentAnalysisPhase] Processing batch ${batchNumber}/${totalBatches}. Analyzing ${batch.length} documents.`);

    // Update progress for each batch
    logger?.emitOperation(`Analyzing documents (batch ${batchNumber}/${totalBatches})...`, { phase: 'analyzing' });

    const results: Array<AnalyzedDocument | null> = await Promise.all(
      batch.map((inp) => analyzeDocument(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) analyzedDocuments.push(r);
    });

    // Update progress based on completion (0.65 to 0.8 range)
    const progressIncrement = 0.65 + (0.15 * (i + batch.length) / analysisInputs.length);
    emitPhaseProgress('analyzing', 'active', progressIncrement, {
      description: `Analyzed ${i + batch.length} of ${analysisInputs.length} documents`,
      subphase: 'analysis',
      metrics: { analyzed: { current: Math.min(i + batch.length, analysisInputs.length), total: analysisInputs.length } },
    });
    // Stream analyzed items incrementally (append; cap each append to 10)
    const analyzedAppend = results
      .filter((r): r is AnalyzedDocument => !!r)
      .slice(0, 10)
      .map((doc) => { let domain = ''; try { domain = new URL(doc.url).hostname.replace(/^www\./,''); } catch {} return { url: doc.url, domain } as { url: string; title?: string; domain?: string }; });
    if (analyzedAppend.length) {
      logger?.emitCollectionUpdate(`${objectiveId}-analyzed`, { kind: 'analyzed', action: 'append', items: analyzedAppend });
    }
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

  // Update to consolidation phase
  emitPhaseProgress('consolidating', 'starting', 0.8, { subphase: 'consolidation', metrics: { consolidated: { current: 0, total: analyzedDocuments.length } } });
  logger?.emitOperation(`Consolidating findings from ${analyzedDocuments.length} documents...`, { phase: 'consolidating', objective: researchPlan.focusedObjective });

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
    const batchNumber = Math.floor(i / CONS_BATCH) + 1;
    const totalBatches = Math.ceil(consolidationInputs.length / CONS_BATCH);

    console.log(`  🌀 [ResearchConsolidationPhase] Processing batch ${batchNumber}/${totalBatches}. Consolidating ${batch.length} documents.`);

    // Update progress for each batch
    logger?.emitOperation(`Consolidating batch ${batchNumber}/${totalBatches}...`, { phase: 'consolidating' });

    const results = await Promise.all(
      batch.map((inp) => consolidateDocument(inp).catch(() => null))
    );
    results.forEach((r) => {
      if (r) consolidatedDocuments.push(r);
    });

    // Update progress based on completion (0.8 to 0.9 range)
    const progressIncrement = 0.8 + (0.1 * (i + batch.length) / consolidationInputs.length);
    emitPhaseProgress('consolidating', 'active', progressIncrement, {
      description: `Consolidated ${i + batch.length} of ${consolidationInputs.length} documents`,
      subphase: 'consolidation',
      metrics: { consolidated: { current: Math.min(i + batch.length, consolidationInputs.length), total: consolidationInputs.length } },
      samples: analyzedDocuments.slice(0, 8).map((doc) => {
        let domain = '';
        try { domain = new URL(doc.url).hostname.replace(/^www\./, ''); } catch {}
        return { url: doc.url, domain } as { url: string; title?: string; domain?: string };
      }),
    });
    // Append consolidated docs as they arrive (approximation: show from analyzedDocuments slice)
    const consAppend = analyzedDocuments.slice(i, i + CONS_BATCH).slice(0, 10).map((doc) => { let domain = ''; try { domain = new URL(doc.url).hostname.replace(/^www\./,''); } catch {} return { url: doc.url, domain } as { url: string; title?: string; domain?: string }; });
    if (consAppend.length) {
      logger?.emitCollectionUpdate(`${objectiveId}-consolidated`, { kind: 'consolidated', action: 'append', items: consAppend });
    }

    if (i + CONS_BATCH < consolidationInputs.length) {
      console.log(`    ⏱️ [ResearchConsolidationPhase] Batch ${batchNumber} processed. Waiting 50ms...`);
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

  // Update to synthesis phase
  emitPhaseProgress('synthesizing', 'starting', 0.9);
  logger?.emitOperation(`Synthesizing final research report...`, { phase: 'synthesizing', objective: researchPlan.focusedObjective });

  // Helper to partition deterministically into balanced groups, each ≤ maxGroupSize
  const partitionIntoGroups = <T,>(items: T[], maxGroupSize: number): T[][] => {
    if (items.length === 0) return [];
    const groupCount = Math.ceil(items.length / maxGroupSize);
    if (groupCount <= 1) return [items.slice()];
    const baseSize = Math.floor(items.length / groupCount);
    let remainder = items.length % groupCount;
    const groups: T[][] = [];
    let start = 0;
    for (let g = 0; g < groupCount; g++) {
      const size = baseSize + (remainder > 0 ? 1 : 0);
      groups.push(items.slice(start, start + size));
      start += size;
      if (remainder > 0) remainder -= 1;
    }
    return groups;
  };

  // Deterministic ordering by domain -> url to keep groups stable
  const orderedConsolidated = [...consolidatedDocuments].sort((a, b) => {
    const ad = (() => { try { return new URL(a.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const bd = (() => { try { return new URL(b.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    if (ad !== bd) return ad.localeCompare(bd);
    return a.url.localeCompare(b.url);
  });

  let finalReportOutput: FinalSynthesisAgentOutput;

  if (orderedConsolidated.length >= FINAL_SYNTHESIS_PARTITION_TRIGGER) {
    const groups = partitionIntoGroups(orderedConsolidated, FINAL_SYNTHESIS_MAX_GROUP_SIZE);
    console.log(`  🧩 [FinalSynthesis] Partitioned into ${groups.length} group(s) of ≤ ${FINAL_SYNTHESIS_MAX_GROUP_SIZE}.`);
    logger?.emitOperation(`Running group synthesis (${groups.length} groups)...`, { phase: 'synthesizing' });
    emitPhaseProgress('synthesizing', 'active', 0.93, { description: `Group synthesis (${groups.length} groups)` });

    // Map: run all groups in parallel
    const groupResults = await Promise.all(
      groups.map((group, idx) => {
        console.log(`    ↪️  [Group ${idx + 1}/${groups.length}] ${group.length} documents`);
        return generateFinalReport({
          consolidatedDocuments: group,
          researchPlan,
          currentDate,
        }).catch((e) => {
          console.error(`    ❌ [Group ${idx + 1}] synthesis error:`, e instanceof Error ? e.message : String(e));
          // Propagate to fail fast; alternatively could continue and reduce without this group
          throw e;
        });
      })
    );

    if (groupResults.length === 1) {
      // Single group: skip reducer hop and use the group's output directly
      finalReportOutput = groupResults[0];
    } else {
      // Reduce: merge group reports into a single final output
      logger?.emitOperation(`Merging ${groupResults.length} group reports...`, { phase: 'synthesizing' });
      emitPhaseProgress('synthesizing', 'active', 0.97, { description: `Merging group reports` });

    const reducerOutput = await generateMergedFinalReport({
      groupReports: groupResults.map((r) => ({ finalDocument: r.finalDocument })),
        researchPlan,
        currentDate,
      });

      finalReportOutput = {
        finalDocument: reducerOutput.finalDocument,
      } as FinalSynthesisAgentOutput;
    }
  } else {
    // Single-call synthesis (original behavior)
    finalReportOutput = await generateFinalReport({
      consolidatedDocuments: orderedConsolidated,
      researchPlan,
      currentDate,
    });
  }
  console.log(`🏁 [ResearchOrchestrator] Research execution pipeline completed. Analyzed ${analyzedDocuments.length} documents, consolidated to ${consolidatedDocuments.length}.`);

  // Final completion
  emitPhaseProgress('synthesizing', 'complete', 1.0);
  // Final curated sources: use consolidated docs as citations fallback (union & dedupe)
  {
    const titleLookup = new Map<string, string | undefined>();
    try {
      for (const d of deduplicated) {
        titleLookup.set(d.originalUrl, d.title ?? undefined);
      }
    } catch {}
    const byKey = new Map<string, { url: string; title?: string; domain?: string }>();
    for (const doc of consolidatedDocuments) {
      const key = canonicalizeUrlForDedup(doc.url);
      let domain = '';
      try { domain = new URL(doc.url).hostname.replace(/^www\./, ''); } catch {}
      const title = titleLookup.get(doc.url) ?? undefined;
      if (!byKey.has(key)) byKey.set(key, { url: doc.url, title, domain });
    }
    logger?.emitSources(objectiveId, { items: Array.from(byKey.values()).slice(0, 30) });
  }
  // Claim spans removed to save tokens; rely on inline citations in final Markdown
  logger?.emitOperation(`Research complete for: ${researchPlan.focusedObjective}`, { phase: 'synthesizing' });

  return {
    researchPlan,
    finalSynthesisReport: {
      finalDocument: finalReportOutput.finalDocument,
    },
  };
}



// app/api/report/phase1/tools/gatherCitations/executor.ts

import { getLogger, asyncLocalStorage } from "@/lib/ai/traceLogger";
import { searchExa } from "@/lib/search/exaClient";
import type { ExaSearchConfig, ExaSearchHit } from "@/lib/search/types";
import type { GatherCitationsInput, GatherCitationsOutput } from "./schema";
import {
  DEFAULT_START_DATE,
  RESULTS_PER_QUERY,
  CONCURRENT_SEARCH_LIMIT,
  MAX_CITATIONS_PER_SUBSUBSECTION,
} from "./constants";
import { curateCitations } from "./curator";
import { generateCitationQueries } from "./queryGeneration/agent";

const TOOL_NAME = "gatherCitationsTool";

// Safe URL canonicalization for deduplication
function canonicalizeUrlForDedup(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hostname = u.hostname.toLowerCase();
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }
    u.hash = "";
    const trackingParams = new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "gclid", "fbclid", "ref", "ref_src", "mc_eid", "xtor",
    ]);
    const params = u.searchParams;
    for (const p of Array.from(params.keys())) {
      if (trackingParams.has(p)) params.delete(p);
    }
    u.pathname = u.pathname.replace(/\/+/, "/");
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

interface SearchTask {
  subsection: string;
  subsubsection: string;
  topic: string;
  searchConfig: ExaSearchConfig;
}

interface SearchResult {
  subsection: string;
  subsubsection: string;
  topic: string;
  citations: ExaSearchHit[];
}

export async function executeGatherCitations(
  input: GatherCitationsInput
): Promise<GatherCitationsOutput> {
  const logger = getLogger();
  const startTime = Date.now();

  const totalPatterns = input.citationRequests.reduce(
    (acc, req) => acc + req.subsubsections.length,
    0
  );

  logger?.logToolInternalStep(TOOL_NAME, "START_CITATION_GATHERING", {
    subsectionsCount: input.citationRequests.length,
    totalPatterns,
  });

  console.log(`\n[${TOOL_NAME}] Starting: ${totalPatterns} patterns across ${input.citationRequests.length} subsections`);

  // 1. Generate optimized queries for each pattern (parallel execution)
  console.log(`\n[${TOOL_NAME}] ═══ Step 1: Query Generation ═══`);
  console.log(`  Generating optimized queries for ${totalPatterns} patterns (parallel)...`);

  const queryGenerationTasks: Array<{
    subsection: string;
    subsubsection: string;
    promise: Promise<{ queryStrategy: string; queries: string[] }>;
  }> = [];

  for (const request of input.citationRequests) {
    for (const subsubsection of request.subsubsections) {
      queryGenerationTasks.push({
        subsection: request.subsection,
        subsubsection: subsubsection.name,
        promise: generateCitationQueries({
          subsection: request.subsection,
          pattern: subsubsection.name,
          summary: subsubsection.summary,
          entities: subsubsection.entities,
        }),
      });
    }
  }

  const generatedQueries = await Promise.all(
    queryGenerationTasks.map(async (task) => {
      const result = await task.promise;
      return {
        subsection: task.subsection,
        subsubsection: task.subsubsection,
        queryStrategy: result.queryStrategy,
        queries: result.queries,
      };
    })
  );

  const totalQueries = generatedQueries.reduce(
    (acc, gen) => acc + gen.queries.length,
    0
  );

  console.log(`\n  ✓ Query generation complete: ${totalQueries} queries across ${totalPatterns} patterns`);
  console.log(`  Query distribution:`);
  for (const gen of generatedQueries) {
    console.log(`    - ${gen.subsubsection}: ${gen.queries.length} queries`);
  }

  logger?.logToolInternalStep(TOOL_NAME, "QUERY_GENERATION_COMPLETE", {
    totalPatterns,
    totalQueries,
  });

  // 2. Flatten generated queries into search tasks
  const searchTasks: SearchTask[] = [];
  for (const generated of generatedQueries) {
    for (const query of generated.queries) {
      searchTasks.push({
        subsection: generated.subsection,
        subsubsection: generated.subsubsection,
        topic: query, // For logging compatibility
        searchConfig: {
          query: query,
          type: "neural",
          numResults: RESULTS_PER_QUERY,
          category: "research paper",
          startPublishedDate: DEFAULT_START_DATE,
          // Note: No domain filtering - trust Exa's "research paper" classification
          // and neural ranking to prioritize quality sources naturally
        },
      });
    }
  }

  console.log(`\n[${TOOL_NAME}] ═══ Step 2: Exa Search ═══`);
  console.log(`  Executing ${searchTasks.length} neural searches (${RESULTS_PER_QUERY} results per query)...`);

  // 3. Execute searches in parallel batches
  const searchResults: SearchResult[] = [];

  for (let i = 0; i < searchTasks.length; i += CONCURRENT_SEARCH_LIMIT) {
    const batch = searchTasks.slice(i, i + CONCURRENT_SEARCH_LIMIT);
    const batchNumber = Math.floor(i / CONCURRENT_SEARCH_LIMIT) + 1;
    const totalBatches = Math.ceil(searchTasks.length / CONCURRENT_SEARCH_LIMIT);

    console.log(`  [Batch ${batchNumber}/${totalBatches}] Searching ${batch.length} topics...`);

    const batchPromises = batch.map(async (task) => {
      try {
        const results = await searchExa(task.searchConfig, true); // useAutoprompt=true for neural

        logger?.logToolInternalStep(TOOL_NAME, "TOPIC_SEARCH_SUCCESS", {
          subsection: task.subsection,
          subsubsection: task.subsubsection,
          topic: task.topic,
          resultsCount: results.length,
        });

        return {
          subsection: task.subsection,
          subsubsection: task.subsubsection,
          topic: task.topic,
          citations: results,
        } as SearchResult;
      } catch (error: unknown) {
        const e = error instanceof Error ? error : new Error(String(error));

        logger?.logToolInternalStep(TOOL_NAME, "TOPIC_SEARCH_ERROR", {
          subsection: task.subsection,
          subsubsection: task.subsubsection,
          topic: task.topic,
          error: { message: e.message, name: e.name },
        });

        console.error(`    ✗ Failed to search topic "${task.topic}":`, e.message);

        return {
          subsection: task.subsection,
          subsubsection: task.subsubsection,
          topic: task.topic,
          citations: [],
        } as SearchResult;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    searchResults.push(...batchResults);
  }

  // 4. Group results by subsection and subsubsection (nested structure)
  const citationsBySubsection: Record<string, Record<string, ExaSearchHit[]>> = {};

  for (const result of searchResults) {
    if (!citationsBySubsection[result.subsection]) {
      citationsBySubsection[result.subsection] = {};
    }
    if (!citationsBySubsection[result.subsection][result.subsubsection]) {
      citationsBySubsection[result.subsection][result.subsubsection] = [];
    }
    citationsBySubsection[result.subsection][result.subsubsection].push(...result.citations);
  }

  // 5. Deduplicate within each subsubsection
  const deduplicatedBySubsection: Record<string, Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>>> = {};

  let totalBeforeDedup = 0;
  let totalAfterDedup = 0;

  for (const [subsection, subsubsections] of Object.entries(citationsBySubsection)) {
    deduplicatedBySubsection[subsection] = {};

    for (const [subsubsection, citations] of Object.entries(subsubsections)) {
      const seenUrls = new Map<string, ExaSearchHit>();

      for (const citation of citations) {
        totalBeforeDedup++;
        const canonicalUrl = canonicalizeUrlForDedup(citation.url);

        if (!seenUrls.has(canonicalUrl)) {
          seenUrls.set(canonicalUrl, citation);
        }
      }

      deduplicatedBySubsection[subsection][subsubsection] = Array.from(seenUrls.values()).map((c) => ({
        title: c.title || "Untitled",
        author: c.author || undefined,
        publishedDate: c.publishedDate || undefined,
        url: c.url,
      }));

      totalAfterDedup += deduplicatedBySubsection[subsection][subsubsection].length;
    }
  }

  logger?.logToolInternalStep(TOOL_NAME, "DEDUPLICATION_COMPLETE", {
    totalCitations: totalBeforeDedup,
    uniqueCitations: totalAfterDedup,
  });

  console.log(`\n[${TOOL_NAME}] ═══ Step 5: Deduplication ═══`);
  console.log(`  ${totalAfterDedup} unique citations (from ${totalBeforeDedup} total)`);

  // 6. Curate citations per subsubsection (select up to max most relevant)
  console.log(`\n[${TOOL_NAME}] ═══ Step 6: Curation ═══`);
  console.log(`  Curating to up to ${MAX_CITATIONS_PER_SUBSUBSECTION} citations per pattern...`);

  const curatedBySubsection: Record<string, Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>>> = {};

  // Helper to extract entities for specific subsubsection
  function getEntitiesForSubsubsection(
    subsection: string,
    subsubsection: string
  ): string[] {
    const request = input.citationRequests.find(r => r.subsection === subsection);
    const subsub = request?.subsubsections.find(s => s.name === subsubsection);
    return subsub?.entities || [];
  }

  let totalCurated = 0;

  for (const [subsection, subsubsections] of Object.entries(deduplicatedBySubsection)) {
    curatedBySubsection[subsection] = {};

    for (const [subsubsection, citations] of Object.entries(subsubsections)) {
      const entities = getEntitiesForSubsubsection(subsection, subsubsection);

      if (citations.length <= MAX_CITATIONS_PER_SUBSUBSECTION) {
        // Already at or below max, keep all
        curatedBySubsection[subsection][subsubsection] = citations;
        totalCurated += citations.length;
        console.log(`    ${subsection} > ${subsubsection}: ${citations.length} citations (no curation needed)`);
      } else {
        // Curate to up to max count
        console.log(`    ${subsection} > ${subsubsection}: curating ${citations.length} → up to ${MAX_CITATIONS_PER_SUBSUBSECTION}...`);

        const curated = await curateCitations({
          subsection,
          subsubsection,
          topics: entities, // Pass entities as topics for curator context
          citations,
          targetCount: MAX_CITATIONS_PER_SUBSUBSECTION,
        });

        curatedBySubsection[subsection][subsubsection] = curated;
        totalCurated += curated.length;

        console.log(`    ${subsection} > ${subsubsection}: ✓ curated to ${curated.length} citations`);

        logger?.logToolInternalStep(TOOL_NAME, "SUBSUBSECTION_CURATED", {
          subsection,
          subsubsection,
          before: citations.length,
          after: curated.length,
        });
      }
    }
  }

  const executionTime = Date.now() - startTime;

  logger?.logToolInternalStep(TOOL_NAME, "CITATION_GATHERING_COMPLETE", {
    totalSearches: searchTasks.length,
    subsections: Object.keys(curatedBySubsection).length,
    totalGathered: totalBeforeDedup,
    uniqueAfterDedup: totalAfterDedup,
    finalCurated: totalCurated,
    executionTimeMs: executionTime,
  });

  console.log(`\n[${TOOL_NAME}] ═══ Step 7: Formatting ═══`);

  // 7. Format citations into markdown (deterministic)
  const formattedReferences = formatReferencesSection(curatedBySubsection);

  console.log(`  Formatted ${totalCurated} citations into markdown (${formattedReferences.length} chars)`);

  logger?.logToolInternalStep(TOOL_NAME, "REFERENCES_FORMATTED", {
    markdownLength: formattedReferences.length,
  });

  // 8. Write to buffer (hidden from agent context)
  console.log(`\n[${TOOL_NAME}] ═══ Step 8: Buffer Storage ═══`);

  const store = asyncLocalStorage.getStore();
  if (store?.citationsBuffer) {
    store.citationsBuffer.formattedReferences = formattedReferences;
    console.log(`  ✓ Citations stored in buffer (${Object.keys(curatedBySubsection).length} subsections)`);
    logger?.logToolInternalStep(TOOL_NAME, "CITATIONS_BUFFERED", {
      bufferWritten: true,
    });
  } else {
    console.warn(`  ✗ [${TOOL_NAME}] citationsBuffer not found in context - citations will not be appended`);
  }

  // Return minimal acknowledgment to agent
  console.log(`\n✓ [${TOOL_NAME}] COMPLETE: ${totalCurated} curated citations in ${(executionTime / 1000).toFixed(1)}s`);
  console.log(`  Returning acknowledgment to primary agent (citationCount: ${totalCurated})\n`);

  return {
    acknowledged: true as const,
    citationCount: totalCurated,
  };
}

/**
 * Formats citations into academic markdown ready for report appendix
 * Pure deterministic transformation - no LLM needed
 */
function formatReferencesSection(
  citationsBySubsection: Record<string, Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>>>
): string {
  let markdown = "## Scientific References\n\n";

  for (const [subsection, subsubsections] of Object.entries(citationsBySubsection)) {
    markdown += `### ${subsection}\n\n`;

    for (const [subsubsection, citations] of Object.entries(subsubsections)) {
      markdown += `#### ${subsubsection}\n\n`;

      for (const citation of citations) {
        // Format based on available metadata
        let formatted: string;

        if (citation.author && citation.publishedDate) {
          // Full format: [Author (Year). Title.](url)
          formatted = `[${citation.author} (${citation.publishedDate}). ${citation.title}.](${citation.url})`;
        } else if (citation.author) {
          // Author only: [Author. Title.](url)
          formatted = `[${citation.author}. ${citation.title}.](${citation.url})`;
        } else if (citation.publishedDate) {
          // Date only: [(Year). Title.](url)
          formatted = `[(${citation.publishedDate}). ${citation.title}.](${citation.url})`;
        } else {
          // Minimal: [Title.](url)
          formatted = `[${citation.title}.](${citation.url})`;
        }

        markdown += `- ${formatted}\n`;
      }

      markdown += "\n";
    }
  }

  return markdown.trim();
}

// app/api/report/phase1/tools/gatherCitations/executor.ts

import { getLogger, asyncLocalStorage } from "@/app/api/chat/lib/traceLogger";
import { searchExa } from "@/app/api/chat/tools/researchOrchestratorTool/exaSearch/exaClient";
import type { ExaSearchConfig, ExaSearchHit } from "@/app/api/chat/tools/researchOrchestratorTool/exaSearch/types";
import type { GatherCitationsInput, GatherCitationsOutput } from "./schema";
import {
  DEFAULT_START_DATE,
  RESULTS_PER_TOPIC,
  CONCURRENT_SEARCH_LIMIT,
  CITATIONS_PER_SUBSECTION,
} from "./constants";
import { curateCitations } from "./curator";

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
  topic: string;
  searchConfig: ExaSearchConfig;
}

interface SearchResult {
  subsection: string;
  topic: string;
  citations: ExaSearchHit[];
}

export async function executeGatherCitations(
  input: GatherCitationsInput
): Promise<GatherCitationsOutput> {
  const logger = getLogger();
  const startTime = Date.now();

  const totalTopics = input.citationRequests.reduce((acc, req) => acc + req.topics.length, 0);

  logger?.logToolInternalStep(TOOL_NAME, "START_CITATION_GATHERING", {
    subsectionsCount: input.citationRequests.length,
    totalTopics,
  });

  console.log(`\n[${TOOL_NAME}] Starting: ${totalTopics} topics across ${input.citationRequests.length} subsections`);

  // 1. Flatten all topics into search tasks
  const searchTasks: SearchTask[] = [];
  for (const request of input.citationRequests) {
    for (const topic of request.topics) {
      searchTasks.push({
        subsection: request.subsection,
        topic,
        searchConfig: {
          query: topic,
          type: "neural",
          numResults: RESULTS_PER_TOPIC,
          category: "research paper",
          startPublishedDate: DEFAULT_START_DATE,
          // Note: No domain filtering - trust Exa's "research paper" classification
          // and neural ranking to prioritize quality sources naturally
        },
      });
    }
  }

  console.log(`\n[${TOOL_NAME}] Gathering citations for ${searchTasks.length} topics across ${input.citationRequests.length} subsections`);

  // 2. Execute searches in parallel batches
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
          topic: task.topic,
          resultsCount: results.length,
        });

        return {
          subsection: task.subsection,
          topic: task.topic,
          citations: results,
        } as SearchResult;
      } catch (error: unknown) {
        const e = error instanceof Error ? error : new Error(String(error));

        logger?.logToolInternalStep(TOOL_NAME, "TOPIC_SEARCH_ERROR", {
          subsection: task.subsection,
          topic: task.topic,
          error: { message: e.message, name: e.name },
        });

        console.error(`    ✗ Failed to search topic "${task.topic}":`, e.message);

        return {
          subsection: task.subsection,
          topic: task.topic,
          citations: [],
        } as SearchResult;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    searchResults.push(...batchResults);
  }

  // 3. Group results by subsection
  const citationsBySubsection: Record<string, ExaSearchHit[]> = {};

  for (const result of searchResults) {
    if (!citationsBySubsection[result.subsection]) {
      citationsBySubsection[result.subsection] = [];
    }
    citationsBySubsection[result.subsection].push(...result.citations);
  }

  // 4. Deduplicate within each subsection
  const deduplicatedBySubsection: Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>> = {};

  let totalBeforeDedup = 0;
  let totalAfterDedup = 0;

  for (const [subsection, citations] of Object.entries(citationsBySubsection)) {
    const seenUrls = new Map<string, ExaSearchHit>();

    for (const citation of citations) {
      totalBeforeDedup++;
      const canonicalUrl = canonicalizeUrlForDedup(citation.url);

      if (!seenUrls.has(canonicalUrl)) {
        seenUrls.set(canonicalUrl, citation);
      }
    }

    deduplicatedBySubsection[subsection] = Array.from(seenUrls.values()).map((c) => ({
      title: c.title || "Untitled",
      author: c.author || undefined,
      publishedDate: c.publishedDate || undefined,
      url: c.url,
    }));

    totalAfterDedup += deduplicatedBySubsection[subsection].length;
  }

  logger?.logToolInternalStep(TOOL_NAME, "DEDUPLICATION_COMPLETE", {
    totalCitations: totalBeforeDedup,
    uniqueCitations: totalAfterDedup,
  });

  console.log(`  Deduplication: ${totalAfterDedup} unique citations from ${totalBeforeDedup} total`);

  // 5. Curate citations per subsection (select most relevant)
  console.log(`  Curating to ${CITATIONS_PER_SUBSECTION} citations per subsection...`);

  const curatedBySubsection: Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>> = {};

  // Build topic map from original input
  const topicsBySubsection = new Map<string, string[]>();
  for (const request of input.citationRequests) {
    topicsBySubsection.set(request.subsection, request.topics);
  }

  let totalCurated = 0;

  for (const [subsection, citations] of Object.entries(deduplicatedBySubsection)) {
    const topics = topicsBySubsection.get(subsection) || [];

    if (citations.length <= CITATIONS_PER_SUBSECTION) {
      // Already at or below target, keep all
      curatedBySubsection[subsection] = citations;
      totalCurated += citations.length;
      console.log(`    ${subsection}: ${citations.length} citations (no curation needed)`);
    } else {
      // Curate to target count
      console.log(`    ${subsection}: curating ${citations.length} → ${CITATIONS_PER_SUBSECTION}...`);

      const curated = await curateCitations({
        subsection,
        topics,
        citations,
        targetCount: CITATIONS_PER_SUBSECTION,
      });

      curatedBySubsection[subsection] = curated;
      totalCurated += curated.length;

      console.log(`    ${subsection}: ✓ curated to ${curated.length} citations`);

      logger?.logToolInternalStep(TOOL_NAME, "SUBSECTION_CURATED", {
        subsection,
        before: citations.length,
        after: curated.length,
      });
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

  console.log(`✓ [${TOOL_NAME}] Complete: ${totalCurated} curated citations (from ${totalAfterDedup} unique) in ${(executionTime / 1000).toFixed(1)}s\n`);

  // 6. Format citations into markdown (deterministic)
  const formattedReferences = formatReferencesSection(curatedBySubsection);

  console.log(`  Formatted ${totalCurated} citations into markdown (${formattedReferences.length} chars)`);

  logger?.logToolInternalStep(TOOL_NAME, "REFERENCES_FORMATTED", {
    markdownLength: formattedReferences.length,
  });

  // 7. Write to buffer (hidden from agent context)
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
  citationsBySubsection: Record<string, Array<{
    title: string;
    author?: string;
    publishedDate?: string;
    url: string;
  }>>
): string {
  let markdown = "## Scientific References\n\n";

  for (const [subsection, citations] of Object.entries(citationsBySubsection)) {
    markdown += `### ${subsection}\n\n`;

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

  return markdown.trim();
}

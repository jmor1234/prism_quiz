import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { fetchFullTextContentsWithOptions } from "@/app/api/chat/tools/researchOrchestratorTool/exaSearch/exaClient";
import { extractFromDocument } from "../extraction/agent";
import { ExtractionResult, ExtractionSummary, ExtractionRequest } from "../types";
import { TOOL_NAME, MAX_CONTENT_LENGTH } from "../constants";

export async function orchestrateTargetedExtraction(
  request: ExtractionRequest
): Promise<ExtractionSummary> {
  const logger = getLogger();
  const { extractionTargets, globalObjective } = request;

  // Start retrieval phase
  logger?.startLogSection('retrieval_phase');

  // Log retrieval start with detailed information
  logger?.logToolInternalStep(TOOL_NAME, 'CONTENT_RETRIEVAL_START', {
    targetCount: extractionTargets.length,
    targets: extractionTargets.map((t) => ({
      url: t.url,
      objective: t.objective,
      hasCrawlOptions: !!t.crawlOptions,
    })),
    globalObjective: globalObjective,
  });

  console.log(`\n📥 [${TOOL_NAME}] Starting content retrieval phase:`);
  console.log(`  📍 Fetching content from ${extractionTargets.length} targets`);

  // Process each target with its specific crawl options
  interface ContentResultWithObjective {
    url: string;
    fullText: string | null;
    success: boolean;
    error?: { message: string; name: string; statusCode?: number };
    objective: string;
  }
  const contentResults: ContentResultWithObjective[] = [];

  for (let i = 0; i < extractionTargets.length; i++) {
    const target = extractionTargets[i];
    const urlId = `url-${i}`;

    // Update URL to retrieving status
    logger?.emitExtractionUrl(urlId, {
      url: target.url,
      status: 'retrieving',
      phase: 'retrieval',
      progress: 0.3,
    });

    console.log(`\n  [${i + 1}/${extractionTargets.length}] Fetching: ${
      target.url.substring(0, 60)
    }...`);
    console.log(
      `     🎯 Objective: "${target.objective.substring(0, 80)}${
        target.objective.length > 80 ? '...' : ''
      }"`
    );

    if (target.crawlOptions) {
      console.log(
        `     🕸️ Crawl: ${target.crawlOptions.subpages || 'default'} subpages`
      );
    }

    const effectiveCrawlOptions = {
      liveCrawl: 'auto' as const,
      ...target.crawlOptions,
    };

    try {
      const results = await fetchFullTextContentsWithOptions(
        [target.url],
        effectiveCrawlOptions
      );
      if (results.length > 0) {
        const first = results[0];
        // Enforce content length cap to avoid giant payloads
        const cappedText = first.fullText && first.fullText.length > MAX_CONTENT_LENGTH
          ? first.fullText.slice(0, MAX_CONTENT_LENGTH)
          : first.fullText;
        contentResults.push({
          url: first.url,
          fullText: cappedText,
          success: first.success,
          error: first.error,
          objective: target.objective,
        });
      }
    } catch (error) {
      // Update URL to failed status
      logger?.emitExtractionUrl(urlId, {
        url: target.url,
        status: 'failed',
        phase: 'retrieval',
        progress: 0.5,
        error: error instanceof Error ? error.message : String(error),
      });

      logger?.logToolInternalStep(TOOL_NAME, 'TARGET_RETRIEVAL_ERROR', {
        target: target.url,
        objective: target.objective,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `     ❌ Failed to fetch content:`,
        error instanceof Error ? error.message : error
      );
      contentResults.push({
        url: target.url,
        fullText: null,
        success: false,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : { message: String(error), name: 'UnknownError' },
        objective: target.objective,
      });
    }
  }

  // Log detailed retrieval results
  const successCount = contentResults.filter((r) => r.success).length;
  const failedUrls = contentResults
    .filter((r) => !r.success)
    .map((r) => ({
      url: r.url,
      error: r.error?.message || 'Unknown error',
    }));

  logger?.logToolInternalStep(TOOL_NAME, 'CONTENT_RETRIEVAL_COMPLETE', {
    total: contentResults.length,
    successful: successCount,
    failed: contentResults.length - successCount,
    failedUrls: failedUrls,
    successfulContentSizes: contentResults
      .filter((r) => r.success && r.fullText)
      .map((r) => ({ url: r.url, size: r.fullText?.length || 0 })),
  });

  console.log(`  ✓ Content retrieval complete: ${successCount}/${contentResults.length} successful`);
  if (failedUrls.length > 0) {
    console.log(`  ⚠️ Failed to retrieve ${failedUrls.length} URLs`);
  }

  // Start extraction phase
  logger?.startLogSection('extraction_phase');

  // Process each document through extraction
  logger?.logToolInternalStep(TOOL_NAME, 'EXTRACTION_PHASE_START', {
    documentsToProcess: successCount,
    hasUrlSpecificObjectives: true,
    globalObjective: globalObjective,
  });

  console.log(`\n🔍 [${TOOL_NAME}] Starting extraction phase:`);
  console.log(`  📋 Processing ${successCount} documents with URL-specific objectives`);
  if (globalObjective) {
    console.log(`  🌐 Global context: "${globalObjective}"`);
  }

  const extractionResults: ExtractionResult[] = [];

  let completedUrls = 0;
  for (let i = 0; i < contentResults.length; i++) {
    const content = contentResults[i];
    const urlId = `url-${i}`;

    if (content.success && content.fullText) {
      const urlObjective = content.objective;

      // Update URL to extracting status
      logger?.emitExtractionUrl(urlId, {
        url: content.url,
        status: 'extracting',
        phase: 'extraction',
        progress: 0.7,
      });

      console.log(
        `\n  📄 [${i + 1}/${contentResults.length}] Processing: ${content.url.substring(0, 60)}...`
      );
      console.log(
        `     - Content size: ${Math.round(content.fullText.length / 1000)}k characters`
      );
      console.log(
        `     - Objective: "${urlObjective.substring(0, 80)}${
          urlObjective.length > 80 ? '...' : ''
        }"`
      );

      try {
        const extractedData = await extractFromDocument({
          url: content.url,
          fullText: content.fullText,
          objective: urlObjective,
        });

        logger?.logToolInternalStep(TOOL_NAME, 'DOCUMENT_EXTRACTION_SUCCESS', {
          url: content.url,
          findingsCount: extractedData.findings.length,
          hasAdditionalContext: !!extractedData.additionalContext,
        });

        extractionResults.push({
          url: content.url,
          success: true,
          extractedData,
        });

        // Update URL to complete status
        completedUrls++;
        logger?.emitExtractionUrl(urlId, {
          url: content.url,
          status: 'complete',
          phase: 'extraction',
          progress: 1,
        });

        // Update session progress
        logger?.emitExtractionSession({
          status: 'active',
          totalUrls: extractionTargets.length,
          completedUrls,
        });

        console.log(
          `     ✓ Extraction successful: ${extractedData.findings.length} findings`
        );
      } catch (error) {
        // Update URL to failed status
        logger?.emitExtractionUrl(urlId, {
          url: content.url,
          status: 'failed',
          phase: 'extraction',
          progress: 0.7,
          error: error instanceof Error ? error.message : String(error),
        });

        logger?.logToolInternalStep(TOOL_NAME, 'DOCUMENT_EXTRACTION_ERROR', {
          url: content.url,
          error: error instanceof Error ? error.message : String(error),
        });

        console.error(
          `     ❌ Extraction failed:`,
          error instanceof Error ? error.message : error
        );
        extractionResults.push({
          url: content.url,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      logger?.logToolInternalStep(TOOL_NAME, 'DOCUMENT_SKIPPED', {
        url: content.url,
        reason: content.error?.message || 'Failed to fetch content',
      });

      extractionResults.push({
        url: content.url,
        success: false,
        error: content.error?.message || 'Failed to fetch content',
      });
    }
  }

  // Start consolidation phase
  logger?.startLogSection('consolidation_phase');

  // Consolidate findings
  logger?.logToolInternalStep(TOOL_NAME, 'CONSOLIDATION_START', {
    totalResults: extractionResults.length,
    successfulExtractions: extractionResults.filter((r) => r.success).length,
  });

  console.log(`\n📊 [${TOOL_NAME}] Consolidating findings...`);
  const urlObjectives = extractionTargets.reduce((acc, target) => {
    acc[target.url] = target.objective;
    return acc;
  }, {} as Record<string, string>);

  const consolidatedFindings = consolidateFindings(
    extractionResults,
    urlObjectives,
    globalObjective
  );

  // Log final statistics
  const totalFindings = extractionResults.reduce(
    (acc, r) => acc + (r.extractedData?.findings.length || 0),
    0
  );

  logger?.logToolInternalStep(TOOL_NAME, 'EXTRACTION_COMPLETE', {
    successful: extractionResults.filter((r) => r.success).length,
    failed: extractionResults.filter((r) => !r.success).length,
    totalFindings: totalFindings,
    consolidatedFindingsLength: consolidatedFindings.length,
  });

  console.log(`  ✓ Consolidation complete`);
  console.log(`  📈 Total findings across all documents: ${totalFindings}`);

  return {
    totalUrls: extractionTargets.length,
    successfulExtractions: extractionResults.filter((r) => r.success).length,
    failedExtractions: extractionResults.filter((r) => !r.success).length,
    results: extractionResults,
    consolidatedFindings,
  };
}

function consolidateFindings(
  results: ExtractionResult[],
  urlObjectives: Record<string, string>,
  globalObjective?: string
): string {
  const logger = getLogger();
  const successfulResults = results.filter((r) => r.success && r.extractedData);

  logger?.logToolInternalStep(TOOL_NAME, 'CONSOLIDATION_PROCESSING', {
    totalResults: results.length,
    successfulResults: successfulResults.length,
    failedResults: results.length - successfulResults.length,
  });

  if (successfulResults.length === 0) {
    logger?.logToolInternalStep(TOOL_NAME, 'CONSOLIDATION_NO_FINDINGS', {
      reason: 'No successful extractions',
    });
    return "No findings were successfully extracted from the provided URLs.";
  }

  // Calculate consolidation statistics
  const totalFindings = successfulResults.reduce(
    (acc, r) => acc + (r.extractedData?.findings.length || 0),
    0
  );
  const avgRelevanceScore =
    successfulResults.reduce((acc, r) => {
      const findings = r.extractedData?.findings || [];
      const scores = findings.map((f) => parseFloat(f.relevance) || 0);
      return acc + scores.reduce((sum, score) => sum + score, 0);
    }, 0) / Math.max(totalFindings, 1);

  logger?.logToolInternalStep(TOOL_NAME, 'CONSOLIDATION_STATISTICS', {
    documentsWithFindings: successfulResults.length,
    totalFindings: totalFindings,
    averageRelevanceScore: avgRelevanceScore.toFixed(2),
    documentsWithAdditionalContext: successfulResults.filter(
      (r) => r.extractedData?.additionalContext
    ).length,
  });

  console.log(`  📈 Consolidation statistics:`);
  console.log(`     - Documents with findings: ${successfulResults.length}`);
  console.log(`     - Total findings: ${totalFindings}`);
  console.log(`     - Average relevance: ${avgRelevanceScore.toFixed(2)}/5`);

  // Group findings by URL
  let consolidation = `## Extracted Information\n\n`;

  if (globalObjective) {
    consolidation += `**Global Context:** ${globalObjective}\n\n`;
  }

  // Add note about URL-specific objectives
  consolidation += `*Note: Each URL was analyzed with its specific objective.*\n\n`;

  for (const result of successfulResults) {
    if (!result.extractedData) continue;

    consolidation += `### From: ${result.url}\n\n`;

    // Add URL-specific objective if available
    const urlObjective = urlObjectives[result.url];
    if (urlObjective) {
      consolidation += `**Extraction Objective:** ${urlObjective}\n\n`;
    }

    // Add summary
    consolidation += `**Summary:** ${result.extractedData.summary}\n\n`;

    // Add findings
    if (result.extractedData.findings.length > 0) {
      consolidation += `**Key Findings:**\n`;
      for (const finding of result.extractedData.findings) {
        consolidation += `- **${finding.insight}**\n`;
        consolidation += `  - Evidence: ${finding.evidence}\n`;
        consolidation += `  - Relevance: ${finding.relevance}\n`;
      }
      consolidation += '\n';
    }

    // Add additional context if present
    if (result.extractedData.additionalContext) {
      consolidation += `**Additional Context:** ${result.extractedData.additionalContext}\n\n`;
    }
  }

  logger?.logToolInternalStep(TOOL_NAME, 'CONSOLIDATION_COMPLETE', {
    consolidatedDocumentLength: consolidation.length,
  });

  return consolidation;
}



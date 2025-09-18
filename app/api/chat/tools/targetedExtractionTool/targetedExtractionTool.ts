import { tool } from "@ai-sdk/provider-utils";
import { z } from "zod";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { orchestrateTargetedExtraction } from "@/app/api/chat/tools/targetedExtractionTool/retrieval/executor";
import { TOOL_NAME } from "./constants";
import { ExtractionSummary, ExtractionRequest } from "./types";

export const targetedExtractionTool = tool({
  description:
    'Deep extraction system for comprehensive understanding from specific sources. Provides detailed information from URLs when synthesis requires more depth. Supports crawling for thorough extraction.',
  inputSchema: z.object({
    extractionTargets: z
      .array(
        z.object({
          url: z.string().url().describe("URL to extract information from"),
          objective: z
            .string()
            .describe("Specific information to extract from this URL"),
          crawlOptions: z
            .object({
              subpages: z
                .number()
                .min(0)
                .max(10)
                .optional()
                .describe("Number of subpages to explore from this URL"),
              subpageTargets: z
                .array(z.string())
                .optional()
                .describe("Keywords to target when exploring subpages"),
            })
            .optional()
            .describe("Optional crawl configuration for this specific URL"),
        })
      )
      .min(1)
      .max(5)
      .describe("Array of extraction targets with URL-specific objectives"),
    globalObjective: z
      .string()
      .optional()
      .describe(
        "Optional global context or overarching objective for all extractions"
      ),
  }),

  execute: async (args: ExtractionRequest) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, args);

    // Emit extraction session starting
    logger?.emitExtractionSession({
      status: 'starting',
      totalUrls: args.extractionTargets.length,
      completedUrls: 0,
    });

    // Initialize all URLs as pending
    args.extractionTargets.forEach((target, index) => {
      logger?.emitExtractionUrl(`url-${index}`, {
        url: target.url,
        status: 'pending',
        progress: 0,
      });
    });

    // Start log section for the entire extraction flow
    logger?.startLogSection('targeted_extraction_flow');

    // Log initial request details
    logger?.logToolInternalStep(TOOL_NAME, 'REQUEST_DETAILS', {
      targetCount: args.extractionTargets.length,
      targets: args.extractionTargets.map((t) => ({
        url: t.url,
        objective: t.objective,
        hasCrawlOptions: !!t.crawlOptions,
      })),
      globalObjective: args.globalObjective,
    });

    console.log(`\n🎯 [${TOOL_NAME}] Starting targeted extraction:`);
    console.log(`📍 Targets to process: ${args.extractionTargets.length}`);
    args.extractionTargets.forEach((target, i) => {
      console.log(`\n   ${i + 1}. URL: ${
        target.url.substring(0, 80)
      }${target.url.length > 80 ? '...' : ''}`);
      console.log(
        `      🎯 Objective: "${target.objective.substring(0, 100)}${
          target.objective.length > 100 ? '...' : ''
        }"`
      );
      if (target.crawlOptions) {
        console.log(
          `      🕸️ Crawl: ${
            target.crawlOptions.subpages || 'default'
          } subpages${
            target.crawlOptions.subpageTargets
              ? `, targeting: ${target.crawlOptions.subpageTargets.join(', ')}`
              : ''
          }`
        );
      }
    });
    if (args.globalObjective) {
      console.log(`\n🌐 Global context: "${args.globalObjective}"`);
    }
    console.log('');

    let error: unknown = null;
    let result: ExtractionSummary | null = null;

    try {
      // Update session to active
      logger?.emitExtractionSession({
        status: 'active',
        totalUrls: args.extractionTargets.length,
        completedUrls: 0,
      });

      const extraction = await orchestrateTargetedExtraction(args);
      result = extraction;

      // Log extraction summary
      const totalFindings = extraction.results.reduce(
        (acc: number, r) => acc + (r.extractedData?.findings.length || 0),
        0
      );
      logger?.logToolInternalStep(TOOL_NAME, 'EXTRACTION_SUMMARY', {
        totalUrls: extraction.totalUrls,
        successfulExtractions: extraction.successfulExtractions,
        failedExtractions: extraction.failedExtractions,
        totalFindings: totalFindings,
      });

      console.log(`\n✅ [${TOOL_NAME}] Extraction complete:`);
      console.log(
        `  ✓ Successful extractions: ${extraction.successfulExtractions}/${extraction.totalUrls}`
      );
      console.log(`  ✗ Failed extractions: ${extraction.failedExtractions}`);
      console.log(`  📊 Total findings: ${totalFindings}`);

      // Emit completion status
      logger?.emitExtractionSession({
        status: 'complete',
        totalUrls: extraction.totalUrls,
        completedUrls: extraction.successfulExtractions,
      });

      // Log successful extractions with key findings
      if (extraction.successfulExtractions > 0) {
        console.log(`\n  Key findings by URL:`);
        extraction.results.forEach((r, i: number) => {
          if (r.success && r.extractedData) {
            console.log(`\n  ${i + 1}. ${r.url.substring(0, 60)}...`);
            console.log(
              `     - ${r.extractedData.findings.length} findings extracted`
            );
            if (r.extractedData.findings.length > 0) {
              console.log(
                `     - Top finding: "${r.extractedData.findings[0].insight.substring(0, 80)}..."`
              );
            }
          }
        });
      }
      console.log('');
    } catch (e) {
      error = e;

      // Emit error status
      logger?.emitExtractionSession({
        status: 'error',
        totalUrls: args.extractionTargets.length,
        completedUrls: 0,
        error: e instanceof Error ? e.message : String(e),
      });

      // Log error details
      logger?.logToolInternalStep(TOOL_NAME, 'EXTRACTION_ERROR', {
        error:
          e instanceof Error
            ? {
                message: e.message,
                name: e.name,
                stack: e.stack?.substring(0, 500),
              }
            : String(e),
      });

      console.error(`\n❌ [${TOOL_NAME}] Extraction failed:`, e);
      throw new Error(
        `Targeted extraction failed: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    } finally {
      logger?.logToolCallEnd(TOOL_NAME, result, error);
    }

    return result as ExtractionSummary;
  },
});



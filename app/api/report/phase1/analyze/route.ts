// app/api/report/phase1/analyze/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";

// Import report-specific cognitive tools
import { reportThinkTool } from "../tools/thinkTool";

// Import recommendation tools
import { recommendDiagnosticsTool } from "../tools/recommendDiagnostics/tool";
import { recommendDietLifestyleTool } from "../tools/recommendDietLifestyle/tool";
import { recommendSupplementsTool } from "../tools/recommendSupplements/tool";

// Import citation tool
import { gatherCitationsTool } from "../tools/gatherCitations/tool";

// Import lab analysis tool
import { analyzeExistingLabsTool } from "../tools/analyzeExistingLabs/tool";

// Reuse infrastructure
import {
  TraceLogger,
  asyncLocalStorage,
} from "@/app/api/chat/lib/traceLogger";
import { TokenEconomics } from "@/app/api/chat/lib/tokenEconomics";
import { createReportCallbacks } from "./streamCallbacks";

// Report-specific
import { getPhase1Case } from "@/server/phase1Cases";
import { savePhase1Result } from "@/server/phase1Results";
import { buildPhase1SystemPrompt } from "./systemPrompt";

export const maxDuration = 1800; // 30 minutes (platform safety net)

// Primary agent timeout - fail cleanly if generation takes too long
const REPORT_GENERATION_TIMEOUT_MS = Number(process.env.REPORT_GENERATION_TIMEOUT_MS) || 780_000; // 13 minutes default

export async function POST(req: Request) {
  let caseId: string;

  try {
    const body = (await req.json()) as { caseId: string };
    caseId = body.caseId;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!caseId || typeof caseId !== "string") {
    return new Response(JSON.stringify({ error: "caseId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load submission from storage
  const caseRecord = await getPhase1Case(caseId);
  if (!caseRecord) {
    return new Response(JSON.stringify({ error: "Case not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Initialize services
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === "true";
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);

  const economics = TokenEconomics.getInstance();

  // Initialize citations buffer for tool to write formatted references
  const citationsBuffer = { formattedReferences: "" };

  return await asyncLocalStorage.run(
    { logger, threadId: undefined, submission: caseRecord.submission, citationsBuffer },
    async () => {
      try {
        // Build system prompt with submission context
        const systemMessages = await buildPhase1SystemPrompt(
          caseRecord.submission
        );

        // Prepare tools (cognitive + per-item enrichment + lab analysis + citations)
        const tools = {
          thinkTool: reportThinkTool,
          recommendDiagnosticsTool,
          recommendDietLifestyleTool,
          recommendSupplementsTool,
          analyzeExistingLabsTool,
          gatherCitationsTool,
        };

        // Create callbacks
        const stepIndexRef = { current: 0 };
        const hasToolsRef = { current: false };
        const callbacks = createReportCallbacks({
          logger,
          economics,
          stepIndexRef,
          threadId: caseId, // Use caseId as threadId for metrics
          hasToolsRef,
        });

        console.log(`\n[Phase1 Analysis] Starting generation for case: ${caseId}`);
        console.log(`[Phase1 Analysis] Timeout set to ${REPORT_GENERATION_TIMEOUT_MS}ms (${REPORT_GENERATION_TIMEOUT_MS / 60000} minutes)`);

        // Create abort controller with timeout
        const abortController = new AbortController();
        const timeoutHandle = setTimeout(() => {
          console.log(`[Phase1 Analysis] Timeout reached (${REPORT_GENERATION_TIMEOUT_MS}ms), aborting generation`);
          abortController.abort();
        }, REPORT_GENERATION_TIMEOUT_MS);

        let result;
        try {
          // Generate report (blocks until complete)
          result = await generateText({
            model: anthropic("claude-sonnet-4-5-20250929"),
            messages: systemMessages,
            tools,
            stopWhen: stepCountIs(50),
            abortSignal: abortController.signal,
            ...callbacks,
            providerOptions: {
              anthropic: {
                thinking: { type: "enabled", budgetTokens: 16000 },
                max_tokens: 64000,
              },
            },
          });
        } catch (error) {
          // Clean up timeout handle
          clearTimeout(timeoutHandle);

          // Check if this was a timeout abort
          if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Report generation timeout: exceeded ${REPORT_GENERATION_TIMEOUT_MS / 60000} minute limit`);
          }

          // Re-throw other errors
          throw error;
        }

        // Clear timeout on successful completion
        clearTimeout(timeoutHandle);

        console.log(`[Phase1 Analysis] Generation complete for case: ${caseId}`);

        // Type assertion for economics compatibility
        interface EventWithMetadata {
          text: string;
          finishReason: string;
          providerMetadata?: {
            anthropic?: {
              cache_read_input_tokens?: number;
              cache_creation_input_tokens?: number;
              [key: string]: unknown;
            };
          };
          usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
            [key: string]: unknown;
          };
          [key: string]: unknown;
        }

        // Calculate and log metrics (moved from onFinish callback)
        const metrics = economics.updateFromEvent(
          result as unknown as EventWithMetadata,
          {
            threadId: caseId,
            hasTools: hasToolsRef.current,
          }
        );
        economics.formatConsoleOutput(metrics);

        // Reset tool flag
        hasToolsRef.current = false;

        // Log performance to trace
        logger.logToolInternalStep("primary_agent", "PERFORMANCE", {
          provider: "anthropic",
          request: metrics.request,
          session: metrics.session,
          metadata: metrics.metadata,
        });

        // Log final response
        logger.logFinalResponse({
          text: result.text,
          finishReason: result.finishReason,
          usage: result.usage,
        });

        // Verify buffer pattern worked correctly
        const agentIncludesCitations = result.text.includes("## Scientific References");
        const bufferHasCitations = citationsBuffer.formattedReferences.includes("## Scientific References");

        // Show what agent output ends with (should be Conclusion, not References)
        const agentLastLines = result.text.split('\n').slice(-3).join('\n');

        console.log(`\n[Phase1 Analysis] Report Assembly:`);
        console.log(`  Agent output: ${result.text.length} chars`);
        console.log(`    - Contains "Scientific References": ${agentIncludesCitations ? '✗ UNEXPECTED' : '✓ NO'}`);
        console.log(`    - Ends with: "${agentLastLines.slice(-60)}..."`);
        console.log(`  Buffer: ${citationsBuffer.formattedReferences.length} chars`);
        console.log(`    - Contains "Scientific References": ${bufferHasCitations ? '✓ YES' : '✗ MISSING'}`);

        // Concatenate report body with citations from buffer
        const fullReport = citationsBuffer.formattedReferences
          ? `${result.text}\n\n${citationsBuffer.formattedReferences}`
          : result.text;

        console.log(`  Final report: ${fullReport.length} chars (body + citations concatenated)\n`);

        // Save combined report to storage
        await savePhase1Result({
          caseId,
          report: fullReport,
        });

        console.log(`[Phase1 Analysis] Report saved for case: ${caseId}`);

        // Finalize and write trace logs
        await logger.finalizeAndWriteLog();

        // Return success response with metadata
        return new Response(
          JSON.stringify({
            success: true,
            caseId,
            finishReason: result.finishReason,
            usage: result.usage,
            steps: stepIndexRef.current,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      } catch (error) {
        // Error handling (moved from onError callback)
        console.error("[Phase1 Analysis] Generation failed:", error);
        await logger.finalizeAndWriteLog(error);

        return new Response(
          JSON.stringify({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Unknown error during generation",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }
  );
}

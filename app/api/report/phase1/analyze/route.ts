// app/api/report/phase1/analyze/route.ts

import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
} from "ai";

// Import tools directly from chat route
import { thinkTool } from "@/app/api/chat/tools/thinkTool/think-tool";
import { researchMemoryTool } from "@/app/api/chat/tools/researchMemoryTool/researchMemoryTool";
import { targetedExtractionTool } from "@/app/api/chat/tools/targetedExtractionTool/targetedExtractionTool";
import { executeResearchPlanTool } from "@/app/api/chat/tools/executeResearchPlanTool/executeResearchPlanTool";

// Import recommendation tools
import { recommendDiagnosticsTool } from "../tools/recommendDiagnostics/tool";
import { recommendDietLifestyleTool } from "../tools/recommendDietLifestyle/tool";
import { recommendSupplementsTool } from "../tools/recommendSupplements/tool";

// Reuse streaming infrastructure
import {
  TraceLogger,
  asyncLocalStorage,
} from "@/app/api/chat/lib/traceLogger";
import { CacheManager } from "@/app/api/chat/lib/cacheManager";
import { TokenEconomics } from "@/app/api/chat/lib/tokenEconomics";
import { createStreamCallbacks } from "@/app/api/chat/lib/streamCallbacks";

// Report-specific
import { getPhase1Case } from "@/server/phase1Cases";
import { savePhase1Result } from "@/server/phase1Results";
import { buildPhase1SystemPrompt } from "./systemPrompt";

export const maxDuration = 300; // 5 minutes

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

  // Initialize services (same as chat)
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === "true";
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);

  const cache = new CacheManager();
  const economics = TokenEconomics.getInstance();

  return await asyncLocalStorage.run(logger, async () => {
    // Build system prompt with submission context
    const systemMessages = await buildPhase1SystemPrompt(caseRecord.submission);

    // Prepare cached tools (chat tools + recommendation tools)
    const cachedTools = cache.prepareCachedTools({
      thinkTool,
      researchMemoryTool,
      targetedExtractionTool,
      executeResearchPlanTool,
      recommendDiagnosticsTool,
      recommendDietLifestyleTool,
      recommendSupplementsTool,
    });

    // No conversation history - just system prompt
    cache.addHistoryCacheBreakpoint(systemMessages);

    // Create stream callbacks
    const stepIndexRef = { current: 0 };
    const hasToolsRef = { current: false };
    const callbacks = createStreamCallbacks({
      logger,
      economics,
      cache,
      stepIndexRef,
      threadId: caseId, // Use caseId as threadId for metrics
      hasToolsRef,
    });

    // Create UI message stream
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Inject stream writer for progress updates
        logger.setStreamWriter({
          write: (data: unknown) =>
            writer.write(data as Parameters<typeof writer.write>[0]),
        });

        // Stream with agent
        const result = streamText({
          model: anthropic("claude-sonnet-4-5-20250929"),
          messages: systemMessages,
          tools: cachedTools,
          stopWhen: stepCountIs(50),
          ...callbacks,
          providerOptions: {
            anthropic: {
              thinking: { type: "enabled", budgetTokens: 16000 },
            },
          },
        });

        // Merge streams
        writer.merge(result.toUIMessageStream());

        // Save result when complete
        try {
          const finalText = await result.text;
          await savePhase1Result({
            caseId,
            report: finalText,
          });
        } catch (error) {
          console.error("Failed to save Phase 1 result:", error);
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  });
}

// app/api/report/phase1/tools/recommendDiagnostics/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { generateDiagnosticRecommendations } from "./agent";
import { recommendDiagnosticsInputSchema, type RecommendDiagnosticsInput } from "./schema";

const TOOL_NAME = "recommendDiagnosticsTool" as const;

export const recommendDiagnosticsTool = tool({
  description:
    "Generate diagnostic test recommendations from Prism's curated database based on identified root causes. Returns up to 5 highest-impact tests per call for root cause investigation.",
  inputSchema: recommendDiagnosticsInputSchema,
  execute: async (input: RecommendDiagnosticsInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      rootCauseCount: input.rootCauses.length,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendDiagnosticsTool",
      action: "Matching diagnostic tests to root causes...",
    });

    console.log(`\n### [${TOOL_NAME}] Generating diagnostic recommendations ###`);
    console.log(`   Root causes: ${input.rootCauses.length}`);
    console.log(`   Objective: ${input.objective}`);

    let recommendations;
    let error: unknown = null;

    try {
      recommendations = await generateDiagnosticRecommendations(input);

      console.log(`   ✅ Generated ${recommendations.recommendations.length} diagnostic recommendations`);

      logger?.emitToolStatus({
        toolName: "recommendDiagnosticsTool",
        action: "complete",
      });
    } catch (e) {
      error = e;
      console.error(`   ❌ [${TOOL_NAME}] Error:`, e);
      throw e;
    } finally {
      logger?.logToolCallEnd(
        TOOL_NAME,
        recommendations ? { recommendationCount: recommendations.recommendations.length } : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return recommendations;
  },
});

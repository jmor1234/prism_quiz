// app/api/report/phase1/tools/recommendSupplements/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { generateSupplementRecommendations } from "./agent";
import { recommendSupplementsInputSchema, type RecommendSupplementsInput } from "./schema";

const TOOL_NAME = "recommendSupplementsTool" as const;

export const recommendSupplementsTool = tool({
  description:
    "Generate supplement and pharmaceutical recommendations from Prism's curated database based on identified root causes. Returns maximum 7 highest-impact supplements/pharmaceuticals for root cause resolution.",
  inputSchema: recommendSupplementsInputSchema,
  execute: async (input: RecommendSupplementsInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      rootCauseCount: input.rootCauses.length,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendSupplementsTool",
      action: "Matching supplements & pharmaceuticals to root causes...",
    });

    console.log(`\n### [${TOOL_NAME}] Generating supplement & pharmaceutical recommendations ###`);
    console.log(`   Root causes: ${input.rootCauses.length}`);
    console.log(`   Objective: ${input.objective}`);

    let recommendations;
    let error: unknown = null;

    try {
      recommendations = await generateSupplementRecommendations(input);

      console.log(`   ✅ Generated ${recommendations.recommendations.length} supplement recommendations`);

      logger?.emitToolStatus({
        toolName: "recommendSupplementsTool",
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

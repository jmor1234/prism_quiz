// app/api/report/phase1/tools/recommendDietLifestyle/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { generateDietLifestyleRecommendations } from "./agent";
import { recommendDietLifestyleInputSchema, type RecommendDietLifestyleInput } from "./schema";

const TOOL_NAME = "recommendDietLifestyleTool" as const;

export const recommendDietLifestyleTool = tool({
  description:
    "Generate diet and lifestyle recommendations from Prism's curated database based on identified root causes. Returns up to 5 highest-impact interventions per call for root cause resolution.",
  inputSchema: recommendDietLifestyleInputSchema,
  execute: async (input: RecommendDietLifestyleInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      rootCauseCount: input.rootCauses.length,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendDietLifestyleTool",
      action: "Matching diet & lifestyle interventions to root causes...",
    });

    console.log(`\n### [${TOOL_NAME}] Generating diet & lifestyle recommendations ###`);
    console.log(`   Root causes: ${input.rootCauses.length}`);
    console.log(`   Objective: ${input.objective}`);

    let recommendations;
    let error: unknown = null;

    try {
      recommendations = await generateDietLifestyleRecommendations(input);

      console.log(`   ✅ Generated ${recommendations.recommendations.length} diet & lifestyle recommendations`);

      logger?.emitToolStatus({
        toolName: "recommendDietLifestyleTool",
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

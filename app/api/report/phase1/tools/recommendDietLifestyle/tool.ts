// app/api/report/phase1/tools/recommendDietLifestyle/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { generateDietLifestyleRecommendations } from "./agent";
import { recommendDietLifestyleInputSchema, type RecommendDietLifestyleInput } from "./schema";

const TOOL_NAME = "recommendDietLifestyleTool" as const;

export const recommendDietLifestyleTool = tool({
  description:
    "Enrich a specific diet/lifestyle directive with database details. Returns either a specific match with implementation guidance or multiple options if the directive is ambiguous. Call once per intervention item from directives.",
  inputSchema: recommendDietLifestyleInputSchema,
  execute: async (input: RecommendDietLifestyleInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      requestedItem: input.requestedItem,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendDietLifestyleTool",
      action: `Enriching intervention: ${input.requestedItem}`,
    });

    console.log(`\n### [${TOOL_NAME}] Enriching diet/lifestyle directive ###`);
    console.log(`   Requested: ${input.requestedItem}`);
    console.log(`   Objective: ${input.objective}`);

    let result;
    let error: unknown = null;

    try {
      result = await generateDietLifestyleRecommendations(input);

      console.log(`   ✅ Result type: ${result.type}`);

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
        result ? { resultType: result.type } : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return result;
  },
});

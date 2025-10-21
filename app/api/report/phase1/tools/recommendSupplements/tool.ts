// app/api/report/phase1/tools/recommendSupplements/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { generateSupplementRecommendations } from "./agent";
import { recommendSupplementsInputSchema, type RecommendSupplementsInput } from "./schema";

const TOOL_NAME = "recommendSupplementsTool" as const;

export const recommendSupplementsTool = tool({
  description:
    "Enrich a specific supplement/pharmaceutical directive with database details. Returns either a specific match with dosage and sourcing or multiple options if the directive is ambiguous. Call once per supplement item from directives.",
  inputSchema: recommendSupplementsInputSchema,
  execute: async (input: RecommendSupplementsInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      requestedItem: input.requestedItem,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendSupplementsTool",
      action: `Enriching supplement: ${input.requestedItem}`,
    });

    console.log(`\n### [${TOOL_NAME}] Enriching supplement/pharmaceutical directive ###`);
    console.log(`   Requested: ${input.requestedItem}`);
    console.log(`   Objective: ${input.objective}`);

    let result;
    let error: unknown = null;

    try {
      result = await generateSupplementRecommendations(input);

      console.log(`   ✅ Result type: ${result.type}`);

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
        result ? { resultType: result.type } : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return result;
  },
});

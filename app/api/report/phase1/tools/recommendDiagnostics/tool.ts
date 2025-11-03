// app/api/report/phase1/tools/recommendDiagnostics/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/lib/ai/traceLogger";
import { generateDiagnosticRecommendations } from "./agent";
import { recommendDiagnosticsInputSchema, type RecommendDiagnosticsInput } from "./schema";

const TOOL_NAME = "recommendDiagnosticsTool" as const;

export const recommendDiagnosticsTool = tool({
  description:
    "Enrich a specific diagnostic directive with database details. Returns either a specific match with implementation details or multiple options if the directive is ambiguous. Call once per diagnostic item from directives.",
  inputSchema: recommendDiagnosticsInputSchema,
  execute: async (input: RecommendDiagnosticsInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      requestedItem: input.requestedItem,
      objective: input.objective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "recommendDiagnosticsTool",
      action: `Enriching diagnostic: ${input.requestedItem}`,
    });

    console.log(`\n### [${TOOL_NAME}] Enriching diagnostic directive ###`);
    console.log(`   Requested: ${input.requestedItem}`);
    console.log(`   Objective: ${input.objective}`);

    let result;
    let error: unknown = null;

    try {
      result = await generateDiagnosticRecommendations(input);

      console.log(`   ✅ Result type: ${result.type}`);

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
        result ? { resultType: result.type } : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return result;
  },
});

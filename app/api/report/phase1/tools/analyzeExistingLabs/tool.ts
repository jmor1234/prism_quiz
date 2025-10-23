// app/api/report/phase1/tools/analyzeExistingLabs/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { analyzeExistingLabs } from "./agent";
import { analyzeExistingLabsInputSchema, type AnalyzeExistingLabsInput } from "./schema";

const TOOL_NAME = "analyzeExistingLabsTool" as const;

export const analyzeExistingLabsTool = tool({
  description:
    "Analyze client's existing lab results from uploaded PDFs. Extracts lab values, matches against Prism's diagnostic database, and provides bioenergetic assessment. Returns structured findings for the Assessment Findings section.",
  inputSchema: analyzeExistingLabsInputSchema,
  execute: async (input: AnalyzeExistingLabsInput) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, {
      clientProfile: input.clientProfile,
      hasObjective: !!input.analysisObjective,
    });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: "analyzeExistingLabsTool",
      action: "Analyzing uploaded lab results...",
    });

    console.log(`\n### [${TOOL_NAME}] Analyzing existing lab PDFs ###`);
    console.log(`   Primary symptoms: ${input.clientProfile.primarySymptoms.join(", ")}`);
    if (input.analysisObjective) {
      console.log(`   Objective: ${input.analysisObjective}`);
    }

    let result;
    let error: unknown = null;

    try {
      result = await analyzeExistingLabs(input);

      console.log(`   ✅ Findings: ${result.findings.length} lab results analyzed`);

      logger?.emitToolStatus({
        toolName: "analyzeExistingLabsTool",
        action: "complete",
      });
    } catch (e) {
      error = e;
      console.error(`   ❌ [${TOOL_NAME}] Error:`, e);
      throw e;
    } finally {
      logger?.logToolCallEnd(
        TOOL_NAME,
        result ? { findingsCount: result.findings.length } : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return result;
  },
});

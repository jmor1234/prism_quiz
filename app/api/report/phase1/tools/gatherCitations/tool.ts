// app/api/report/phase1/tools/gatherCitations/tool.ts

import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { executeGatherCitations } from "./executor";
import { gatherCitationsInputSchema, type GatherCitationsInput } from "./schema";

const TOOL_NAME = "gatherCitationsTool" as const;

export const gatherCitationsTool = tool({
  description:
    "Gather academic citations to support report content. Searches research papers for specified topics and returns organized citation metadata ready for References section formatting.",
  inputSchema: gatherCitationsInputSchema,
  execute: async (input: GatherCitationsInput) => {
    const logger = getLogger();

    const totalTopics = input.citationRequests.reduce(
      (acc, req) => acc + req.topics.length,
      0
    );

    logger?.logToolCallStart(TOOL_NAME, {
      subsectionsCount: input.citationRequests.length,
      totalTopics,
    });

    logger?.emitToolStatus({
      toolName: "gatherCitationsTool",
      action: `Gathering citations for ${totalTopics} topics...`,
    });

    console.log(`\n### [${TOOL_NAME}] Starting citation gathering ###`);

    let result;
    let error: unknown = null;

    try {
      result = await executeGatherCitations(input);

      logger?.emitToolStatus({
        toolName: "gatherCitationsTool",
        action: "complete",
      });
    } catch (e) {
      error = e;
      console.error(`   ❌ [${TOOL_NAME}] Error:`, e);
      throw e;
    } finally {
      logger?.logToolCallEnd(
        TOOL_NAME,
        result
          ? {
              uniqueCitations: result.uniqueCitations,
              subsections: Object.keys(result.citationsBySubsection).length,
            }
          : {},
        error
      );
    }

    console.log(`### [${TOOL_NAME}] Complete ###\n`);

    return result;
  },
});

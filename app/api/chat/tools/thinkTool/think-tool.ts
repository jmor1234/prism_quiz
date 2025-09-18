import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "thinkTool" as const;

export const thinkTool = tool({
  description:
    "Your reasoning space for analyzing findings and planning research strategy. Essential for making dynamic decisions based on results.",
  inputSchema: z.object({
    thought: z
      .string()
      .describe(
        "Your structured reasoning about research decisions, information analysis, or response planning. Be specific about your evaluation of previous results and justification for the next action."
      ),
  }),
  execute: async ({ thought }: { thought: string }) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, { thought });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: 'thinkTool',
      action: 'Thinking about research strategy...'
    });

    console.log(`\n🤔 [${TOOL_NAME}] Reasoning: ${thought}\n`);

    const result = { acknowledged: true } as const;
    logger?.logToolCallEnd(TOOL_NAME, result, null);
    return result;
  },
});



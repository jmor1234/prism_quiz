import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "thinkTool" as const;

export const reportThinkTool = tool({
  description:
    "Your reasoning space for phase orchestration, quality assessment, and execution decisions within this structured workflow.",
  inputSchema: z.object({
    thought: z
      .string()
      .describe(
        "Your structured reasoning about phase transitions, evidence sufficiency, or next actions. Be specific about your evaluation and justification."
      ),
  }),
  execute: async ({ thought }: { thought: string }) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, { thought });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: 'thinkTool',
      action: 'Evaluating analysis and next steps...'
    });

    console.log(`\n🤔 [${TOOL_NAME}] Reasoning: ${thought}\n`);

    const result = { acknowledged: true } as const;
    logger?.logToolCallEnd(TOOL_NAME, result, null);
    return result;
  },
});


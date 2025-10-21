import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "thinkTool" as const;

export const reportThinkTool = tool({
  description:
    "Use this to track extraction results, plan enrichment steps, or verify phase completion. Logs your reasoning without changing external state. Essential for: capturing parsed directives, noting ambiguities, tracking pending tool calls, and verifying all operations complete before proceeding.",
  inputSchema: z.object({
    thought: z
      .string()
      .describe(
        "Your structured tracking or reasoning: extraction results, enrichment planning, completion verification, or directive disambiguation."
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


import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "researchMemoryTool" as const;

// Note: This is in-memory per server instance and request lifecycle.
const researchMemory: Array<{ timestamp: string; content: string }> = [];

// Clear function to reset state between requests
export function clearResearchMemory() {
  researchMemory.length = 0;
}

export const reportResearchMemoryTool = tool({
  description:
    "Track findings, evidence, and connections across phases within this single-session analysis.",
  inputSchema: z.object({
    note: z
      .string()
      .describe(
        "Your analysis note - key findings, evidence discovered, phase connections, or synthesis observations."
      ),
  }),
  execute: async ({ note }: { note: string }) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, { note });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: 'researchMemoryTool',
      action: 'Recording analysis note...'
    });

    const timestamp = new Date().toISOString();
    researchMemory.push({ timestamp, content: note });

    console.log(`\n📝 [${TOOL_NAME}] Analysis note recorded:`, note);
    console.log(`📚 Total analysis notes: ${researchMemory.length}\n`);

    const result = {
      acknowledged: true as const,
      totalNotes: researchMemory.length,
      currentMemory: researchMemory
        .map((entry, index) => `[Note ${index + 1}] ${entry.content}`)
        .join("\n"),
    };

    logger?.logToolCallEnd(TOOL_NAME, result, null);
    return result;
  },
});


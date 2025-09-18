import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "researchMemoryTool" as const;

// Note: This is in-memory per server instance and request lifecycle. For
// durable persistence across instances/devices, back this with a datastore.
const researchMemory: Array<{ timestamp: string; content: string }> = [];

export const researchMemoryTool = tool({
  description:
    "Persistent knowledge accumulation throughout the conversation. Builds cumulative understanding and tracks key insights discovered through retrieval and reasoning.",
  inputSchema: z.object({
    note: z
      .string()
      .describe(
        "Your research note - findings, gaps, connections, or progress observations"
      ),
  }),
  execute: async ({ note }: { note: string }) => {
    const logger = getLogger();
    logger?.logToolCallStart(TOOL_NAME, { note });

    // Emit tool status for UI feedback
    logger?.emitToolStatus({
      toolName: 'researchMemoryTool',
      action: 'Recording research note...'
    });

    const timestamp = new Date().toISOString();
    researchMemory.push({ timestamp, content: note });

    console.log(`\n📝 [${TOOL_NAME}] Research note recorded:`, note);
    console.log(`📚 Total research notes: ${researchMemory.length}\n`);

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



import { z } from "zod";
import { tool } from "@ai-sdk/provider-utils";
import { getLogger, getThreadId } from "@/app/api/chat/lib/traceLogger";

const TOOL_NAME = "researchMemoryTool" as const;

// Thread-scoped memory storage
// Map of threadId → memory array for conversation-level persistence
const researchMemoryByThread = new Map<string, Array<{ timestamp: string; content: string }>>();

// Cleanup counter for periodic old thread removal
let accessCount = 0;

// Remove threads older than 1 hour to prevent unbounded memory growth
function cleanupOldThreads() {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  
  for (const [threadId, memory] of researchMemoryByThread.entries()) {
    if (memory.length === 0) continue;
    
    const lastUpdate = memory[memory.length - 1]?.timestamp;
    if (lastUpdate && now - new Date(lastUpdate).getTime() > ONE_HOUR) {
      researchMemoryByThread.delete(threadId);
      console.log(`[${TOOL_NAME}] Cleaned up old thread: ${threadId}`);
    }
  }
}

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

    // Get thread-specific memory (default to 'default' for backward compatibility)
    const threadId = getThreadId() || 'default';
    const researchMemory = researchMemoryByThread.get(threadId) || [];
    
    // Add new note
    const timestamp = new Date().toISOString();
    researchMemory.push({ timestamp, content: note });
    
    // Update thread memory
    researchMemoryByThread.set(threadId, researchMemory);

    // Periodic cleanup every 10th access
    accessCount++;
    if (accessCount >= 10) {
      accessCount = 0;
      cleanupOldThreads();
    }

    console.log(`\n📝 [${TOOL_NAME}] Research note recorded (thread: ${threadId}):`, note);
    console.log(`📚 Thread research notes: ${researchMemory.length}\n`);

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



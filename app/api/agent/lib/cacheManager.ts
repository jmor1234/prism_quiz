// app/api/agent/lib/cacheManager.ts

import type { ModelMessage, SystemModelMessage, ToolSet } from "ai";

const CACHE_CONTROL_EPHEMERAL = { type: "ephemeral" as const };

/**
 * Three-tier Anthropic prompt caching (5-minute TTL):
 * 1. Tool schemas — cache_control on the last tool definition
 * 2. System prompt — stable portion cached, dynamic portion fresh
 * 3. Conversation history — cache breakpoint at the end of message history
 */
export class CacheManager {
  /**
   * Build system messages with caching split.
   * The stable portion (instructions + knowledge) is cached.
   * The dynamic portion (quiz context + date) is always fresh.
   */
  buildCachedSystemMessages(prompt: {
    stable: string;
    dynamic: string;
  }): SystemModelMessage[] {
    return [
      {
        role: "system",
        content: prompt.stable,
        providerOptions: {
          anthropic: { cacheControl: CACHE_CONTROL_EPHEMERAL },
        },
      },
      {
        role: "system",
        content: prompt.dynamic,
      },
    ];
  }

  /**
   * Mark the last tool with cache_control so the entire tool schema block is cached.
   */
  prepareCachedTools<T extends ToolSet>(tools: T): T {
    const entries = Object.entries(tools);
    if (entries.length === 0) return tools;

    const lastIndex = entries.length - 1;
    const result: Record<string, unknown> = {};

    for (let i = 0; i < entries.length; i++) {
      const [name, t] = entries[i];
      if (i === lastIndex) {
        result[name] = {
          ...t,
          providerOptions: {
            anthropic: { cacheControl: CACHE_CONTROL_EPHEMERAL },
          },
        };
      } else {
        result[name] = t;
      }
    }

    return result as T;
  }

  /**
   * Apply a cache breakpoint to the last non-system message.
   * Called on every step to incrementally advance the history cache
   * boundary during multi-step tool loops.
   *
   * Strips stale breakpoints from previous steps first — ensures
   * exactly one history breakpoint at all times.
   */
  applyHistoryCacheBreakpoint(messages: ModelMessage[]): ModelMessage[] {
    let lastNonSystemIdx = -1;

    // Forward pass: strip stale breakpoints, track last non-system index
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "system") continue;
      lastNonSystemIdx = i;

      if (msg.providerOptions?.anthropic) {
        const anthropic = msg.providerOptions.anthropic as Record<
          string,
          unknown
        >;
        if ("cacheControl" in anthropic) {
          delete anthropic.cacheControl;
        }
      }
    }

    // Apply fresh breakpoint to the last non-system message only
    if (lastNonSystemIdx >= 0) {
      const msg = messages[lastNonSystemIdx];
      msg.providerOptions = {
        ...msg.providerOptions,
        anthropic: {
          ...(msg.providerOptions?.anthropic as
            | Record<string, unknown>
            | undefined),
          cacheControl: CACHE_CONTROL_EPHEMERAL,
        },
      };
    }

    return messages;
  }
}

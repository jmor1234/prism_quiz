// app/api/chat/lib/cacheManager.ts

import { type ModelMessage } from 'ai';
import { buildSystemPrompt } from '../systemPrompt';

/**
 * CacheManager handles all three-tier caching strategies for Anthropic:
 * 1. Tool schema caching (5m TTL with free refresh on active use)
 * 2. System prompt caching (stable 5m with free refresh / dynamic fresh)
 * 3. Conversation history caching (5m TTL)
 *
 * The 5m TTL creates a "sliding window" that follows active conversations,
 * refreshing for FREE when accessed within 5 minutes, achieving 37.5% reduction
 * in cache write costs while maintaining identical read performance.
 */
export class CacheManager {
  /**
   * Wraps a tool definition with Anthropic cache control (5m TTL)
   * Free refresh when used within 5 minutes keeps cache warm during active sessions
   */
  withAnthropicToolCache<T extends Record<string, unknown>>(toolDef: T): T {
    const existingProviderOptions = (toolDef as {providerOptions?: Record<string, unknown>}).providerOptions || {};
    const existingAnthropic = (existingProviderOptions as {anthropic?: Record<string, unknown>}).anthropic || {};

    return {
      ...toolDef,
      providerOptions: {
        ...existingProviderOptions,
        anthropic: {
          ...existingAnthropic,
          cacheControl: { type: 'ephemeral', ttl: '5m' },
        },
      },
    };
  }

  /**
   * Adds a cache breakpoint before the last user message to maximize history reuse
   * This enables caching of the entire conversation up to the current turn
   */
  addHistoryCacheBreakpoint(messages: ModelMessage[]): void {
    // Find index of the *last* user message (the current user turn)
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    // Cache boundary is the message just before that last user turn
    const boundaryIdx = lastUserIdx > 0 ? lastUserIdx - 1 : -1;

    if (boundaryIdx >= 0 && messages[boundaryIdx]) {
      // Attach cache control at the message level
      const m = messages[boundaryIdx] as ModelMessage & {
        providerOptions?: {
          anthropic?: {
            cacheControl?: { type: 'ephemeral'; ttl?: '5m' | '1h' };
            [key: string]: unknown;
          };
          [key: string]: unknown;
        };
      };

      const existingProviderOptions = m.providerOptions || {};
      const existingAnthropic = (existingProviderOptions.anthropic as Record<string, unknown>) || {};

      m.providerOptions = {
        ...existingProviderOptions,
        anthropic: {
          ...existingAnthropic,
          cacheControl: { type: 'ephemeral', ttl: '5m' },
        },
      };
    }
  }

  /**
   * Builds cached system messages with split stable/dynamic architecture
   * @returns Array of [stable cached message, dynamic fresh message]
   */
  buildCachedSystemMessages(formattedDate: string): ModelMessage[] {
    const { stable, dynamic } = buildSystemPrompt(formattedDate);

    // Create cached stable system message (5m TTL - free refresh on active use)
    const cachedSystemMsg: ModelMessage = {
      role: 'system',
      content: stable,
      providerOptions: {
        anthropic: { cacheControl: { type: 'ephemeral', ttl: '5m' } },
      },
    };

    // Create dynamic system message (no cache - changes daily)
    const dynamicSystemMsg: ModelMessage = {
      role: 'system',
      content: dynamic,
    };

    return [cachedSystemMsg, dynamicSystemMsg];
  }

  /**
   * Prepares tools with caching strategy: only the last tool gets cache control
   * This caches the entire tool schema set efficiently
   */
  prepareCachedTools<T extends Record<string, unknown>>(tools: T): T {
    const toolEntries = Object.entries(tools);
    const lastIndex = toolEntries.length - 1;

    const cachedTools = Object.fromEntries(
      toolEntries.map(([key, tool], index) => {
        // Only apply cache to the last tool (caches entire toolset)
        if (index === lastIndex) {
          return [key, this.withAnthropicToolCache(tool as Record<string, unknown>)];
        }
        return [key, tool];
      })
    );

    return cachedTools as T;
  }

  /**
   * Prepares messages for a streaming step with cache breakpoint
   * Used in prepareStep callback to maintain cache across multi-step loops
   */
  prepareMessagesForStep(messages: ModelMessage[]): ModelMessage[] {
    const msgs = [...messages];
    this.addHistoryCacheBreakpoint(msgs);
    return msgs;
  }
}
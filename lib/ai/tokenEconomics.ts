// app/api/chat/lib/tokenEconomics.ts

/**
 * TokenEconomics tracks session-level token usage and calculates real USD costs
 * with Anthropic's caching discount model
 */

// Claude Sonnet 4 pricing (per million tokens)
const SONNET_4_INPUT_PRICE = 3.00;         // $3.00/MTok
const SONNET_4_CACHE_READ_PRICE = 0.30;    // $0.30/MTok (90% discount for reads)
const SONNET_4_CACHE_WRITE_5M_PRICE = 3.75; // $3.75/MTok (1.25x for 5m TTL writes)
const SONNET_4_OUTPUT_PRICE = 15.00;       // $15.00/MTok

interface SessionTokens {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  totalCostSavings: number;
  totalActualCost: number;
  totalCostWithoutCache: number;
  sessionStartTime: Date;
}

interface ThreadTokens {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  totalContextTokens: number;
  totalActualCost: number;
  totalCostWithoutCache: number;
  totalCostSavings: number;
  startedAt: Date;
  persistentContextTokens: number;
  lastSettledContext: number;
  hasToolsInCurrentRequest: boolean;
}

interface AnthropicCacheMetadata {
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  [key: string]: unknown;
}

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface EventWithMetadata {
  providerMetadata?: {
    anthropic?: AnthropicCacheMetadata;
  };
  totalUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface CacheMetrics {
  request: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    totalTokens: number;
    conversationTokens: number;
    cacheMultiplier: number;
    trueCacheEfficiency: number;
    actualCostUSD: number;
    costWithoutCacheUSD: number;
    costSavingsUSD: number;
    costReductionPercent: number;
  };
  session: {
    totalRequests: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalContextTokens: number;
    cacheEfficiency: number;
    cacheMultiplier: number;
    actualCostUSD: number;
    costWithoutCacheUSD: number;
    totalSavingsUSD: number;
    totalCostReductionPercent: number;
    uptimeMinutes: number;
  };
  metadata?: AnthropicCacheMetadata;
  cacheCreateTokens?: number;
  cacheReadTokens?: number;
  thread?: {
    id: string;
    totalRequests: number;
    totalTokens: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalContextTokens: number;
    cacheEfficiency: number; // percent
    cacheMultiplier: number; // x
    actualCostUSD: number;
    costWithoutCacheUSD: number;
    totalSavingsUSD: number;
    totalCostReductionPercent: number; // percent
    uptimeMinutes: number;
  };
}

export class TokenEconomics {
  private static instance: TokenEconomics;
  private sessionTokens: SessionTokens;
  private threadTokens: Map<string, ThreadTokens>;

  private constructor() {
    this.sessionTokens = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalCachedTokens: 0,
      totalCostSavings: 0,
      totalActualCost: 0,
      totalCostWithoutCache: 0,
      sessionStartTime: new Date(),
    };
    this.threadTokens = new Map<string, ThreadTokens>();
  }

  /**
   * Singleton pattern for session-level tracking
   */
  static getInstance(): TokenEconomics {
    if (!TokenEconomics.instance) {
      TokenEconomics.instance = new TokenEconomics();
    }
    return TokenEconomics.instance;
  }

  /**
   * Updates session metrics from a streaming event and returns cache metrics
   */
  updateFromEvent(event: EventWithMetadata, opts?: { threadId?: string; hasTools?: boolean }): CacheMetrics {
    // CRITICAL: Extract PRIMARY AGENT tokens from anthropic.usage, not totalUsage aggregate
    const providerMeta = event.providerMetadata as {
      anthropic?: {
        usage?: AnthropicUsage;
        cache_read_input_tokens?: number;
        cache_creation_input_tokens?: number;
        [key: string]: unknown;
      };
    };

    const anthropicUsage = providerMeta?.anthropic?.usage;

    // Input: Primary agent only (excludes tool internal LLM calls)
    const requestInputTokens = anthropicUsage?.input_tokens ?? event.totalUsage?.inputTokens ?? 0;

    // Output: Actual response to user (use aggregate as this is the full response)
    const requestOutputTokens = event.totalUsage?.outputTokens ?? 0;
    const requestTotalTokens = requestInputTokens + requestOutputTokens;

    // Extract cache metadata from anthropic.usage first, then fall back to metadata
    let cacheReadTokens = 0;
    let cacheCreateTokens = 0;

    if (anthropicUsage) {
      // Prefer usage object for cache tokens
      cacheReadTokens = anthropicUsage.cache_read_input_tokens || 0;
      cacheCreateTokens = anthropicUsage.cache_creation_input_tokens || 0;
    } else if (providerMeta?.anthropic) {
      // Fallback to metadata fields
      cacheReadTokens = providerMeta.anthropic.cache_read_input_tokens || 0;
      cacheCreateTokens = providerMeta.anthropic.cache_creation_input_tokens || 0;
    } else {
      // Last resort: use totalUsage cached tokens
      const usageCachedTokens = event.totalUsage?.cachedInputTokens || 0;
      cacheReadTokens = usageCachedTokens;
      cacheCreateTokens = 0;
    }

    // Calculate real costs in USD with correct split:
    // - Cache creations are a subset of current input and should be billed at cache price, not added to fresh again
    const freshNonCacheInputTokens = Math.max(0, requestInputTokens - cacheCreateTokens);
    const freshNonCacheCost = (freshNonCacheInputTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * SONNET_4_CACHE_READ_PRICE;
    const cacheCreateCost = (cacheCreateTokens / 1_000_000) * SONNET_4_CACHE_WRITE_5M_PRICE;
    const outputCost = (requestOutputTokens / 1_000_000) * SONNET_4_OUTPUT_PRICE;
    const totalCostWithCache = freshNonCacheCost + cacheReadCost + cacheCreateCost + outputCost;

    // CRITICAL: Context = input + cache reads + cache writes (all three components)
    const conversationContextTokens = requestInputTokens + cacheReadTokens + cacheCreateTokens;
    // Cost without caching (all context treated as fresh input)
    const allInputCost = (conversationContextTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
    const totalCostWithoutCache = allInputCost + outputCost;
    const realCostSavings = totalCostWithoutCache - totalCostWithCache;

    // Update session totals
    this.sessionTokens.totalRequests += 1;
    this.sessionTokens.totalInputTokens += requestInputTokens;
    this.sessionTokens.totalOutputTokens += requestOutputTokens;
    this.sessionTokens.totalTokens += requestTotalTokens;
    // Track cached reads only for context accounting
    this.sessionTokens.totalCachedTokens += cacheReadTokens;
    this.sessionTokens.totalCostSavings += realCostSavings;
    this.sessionTokens.totalActualCost += totalCostWithCache;
    this.sessionTokens.totalCostWithoutCache += totalCostWithoutCache;

    // Optionally update per-thread totals
    let threadMetrics: CacheMetrics['thread'] | undefined;
    if (opts?.threadId) {
      const id = opts.threadId;
      let t = this.threadTokens.get(id);
      if (!t) {
        t = {
          totalRequests: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          totalCachedTokens: 0,
          totalContextTokens: 0,
          totalActualCost: 0,
          totalCostWithoutCache: 0,
          totalCostSavings: 0,
          startedAt: new Date(),
          persistentContextTokens: 3000,
          lastSettledContext: 3000,
          hasToolsInCurrentRequest: false,
        };
        this.threadTokens.set(id, t);
      }
      t.totalRequests += 1;
      t.totalInputTokens += requestInputTokens;
      t.totalOutputTokens += requestOutputTokens;
      t.totalTokens += requestTotalTokens;
      // Per-thread: cached reads and context-in only
      t.totalCachedTokens += cacheReadTokens;
      t.totalContextTokens += conversationContextTokens;
      t.totalActualCost += totalCostWithCache;
      t.totalCostWithoutCache += totalCostWithoutCache;
      t.totalCostSavings += realCostSavings;

      // Settled context detection algorithm
      if (opts?.hasTools) {
        // Tools active - estimate persistent context by subtracting tool overhead
        // Primary agent input tokens already exclude tool internal LLM calls
        // When tools run, context includes tool results (~30% overhead empirically)
        const estimatedToolOverhead = Math.floor(requestInputTokens * 0.3);
        t.persistentContextTokens = Math.max(
          t.persistentContextTokens,
          conversationContextTokens - estimatedToolOverhead
        );
        t.hasToolsInCurrentRequest = true;
      } else {
        // This is "settled" context - no tool results (most accurate)
        // UPDATE persistent context
        t.persistentContextTokens = conversationContextTokens;
        t.lastSettledContext = conversationContextTokens;
        t.hasToolsInCurrentRequest = false;
      }

      const tContext = t.totalContextTokens;
      const tEfficiency = tContext > 0 ? t.totalCachedTokens / tContext : 0;
      const tMultiplier = t.totalInputTokens > 0 ? t.totalCachedTokens / t.totalInputTokens : 0;
      const tUptime = Math.floor((Date.now() - t.startedAt.getTime()) / 1000 / 60);

      threadMetrics = {
        id,
        totalRequests: t.totalRequests,
        totalTokens: t.totalTokens,
        totalInputTokens: t.totalInputTokens,
        totalOutputTokens: t.totalOutputTokens,
        totalCachedTokens: t.totalCachedTokens,
        totalContextTokens: t.totalContextTokens,
        cacheEfficiency: Math.round(tEfficiency * 100),
        cacheMultiplier: Math.round(tMultiplier * 10) / 10,
        actualCostUSD: Math.round(t.totalActualCost * 10000) / 10000,
        costWithoutCacheUSD: Math.round(t.totalCostWithoutCache * 10000) / 10000,
        totalSavingsUSD: Math.round(t.totalCostSavings * 10000) / 10000,
        totalCostReductionPercent: t.totalCostWithoutCache > 0 ? Math.round((t.totalCostSavings / t.totalCostWithoutCache) * 100 * 10) / 10 : 0,
        uptimeMinutes: tUptime,
      };
    }

    // Calculate cache metrics
    const cacheMultiplier = requestInputTokens > 0 ? cacheReadTokens / requestInputTokens : 0;
    const trueCacheEfficiency = conversationContextTokens > 0 ? cacheReadTokens / conversationContextTokens : 0;

    // Session metrics
    const sessionTotalContextTokens = this.sessionTokens.totalInputTokens + this.sessionTokens.totalCachedTokens;
    const sessionCacheEfficiency = sessionTotalContextTokens > 0 ? this.sessionTokens.totalCachedTokens / sessionTotalContextTokens : 0;
    const sessionCacheMultiplier = this.sessionTokens.totalInputTokens > 0 ? this.sessionTokens.totalCachedTokens / this.sessionTokens.totalInputTokens : 0;
    const sessionUptime = Math.floor((Date.now() - this.sessionTokens.sessionStartTime.getTime()) / 1000 / 60);

    return {
      request: {
        inputTokens: requestInputTokens,
        outputTokens: requestOutputTokens,
        // Expose cached reads for this run
        cachedTokens: cacheReadTokens,
        totalTokens: requestTotalTokens,
        conversationTokens: conversationContextTokens,
        cacheMultiplier: Math.round(cacheMultiplier * 10) / 10,
        trueCacheEfficiency: Math.round(trueCacheEfficiency * 100),
        actualCostUSD: Math.round(totalCostWithCache * 100000) / 100000,
        costWithoutCacheUSD: Math.round(totalCostWithoutCache * 100000) / 100000,
        costSavingsUSD: Math.round(realCostSavings * 100000) / 100000,
        costReductionPercent: totalCostWithoutCache > 0 ? Math.round((realCostSavings / totalCostWithoutCache) * 100 * 10) / 10 : 0,
      },
      session: {
        totalRequests: this.sessionTokens.totalRequests,
        totalTokens: this.sessionTokens.totalTokens,
        totalInputTokens: this.sessionTokens.totalInputTokens,
        totalOutputTokens: this.sessionTokens.totalOutputTokens,
        totalCachedTokens: this.sessionTokens.totalCachedTokens,
        totalContextTokens: sessionTotalContextTokens,
        cacheEfficiency: Math.round(sessionCacheEfficiency * 100),
        cacheMultiplier: Math.round(sessionCacheMultiplier * 10) / 10,
        actualCostUSD: Math.round(this.sessionTokens.totalActualCost * 10000) / 10000,
        costWithoutCacheUSD: Math.round(this.sessionTokens.totalCostWithoutCache * 10000) / 10000,
        totalSavingsUSD: Math.round(this.sessionTokens.totalCostSavings * 10000) / 10000,
        totalCostReductionPercent: this.sessionTokens.totalCostWithoutCache > 0 ? Math.round((this.sessionTokens.totalCostSavings / this.sessionTokens.totalCostWithoutCache) * 100 * 10) / 10 : 0,
        uptimeMinutes: sessionUptime,
      },
      metadata: providerMeta?.anthropic as AnthropicCacheMetadata | undefined,
      cacheCreateTokens,
      cacheReadTokens,
      thread: threadMetrics,
    };
  }

  /**
   * Formats and outputs cache metrics to console
   */
  formatConsoleOutput(metrics: CacheMetrics): void {
    const { request } = metrics;
    const th = metrics.thread;

    const promptFresh = request.inputTokens;
    const promptCached = request.cachedTokens;
    const cacheReadTokens = metrics.cacheReadTokens || 0;
    const cacheWriteTokens = metrics.cacheCreateTokens || 0;
    const promptContextTokens = request.conversationTokens; // matches usage.promptTokens (full context)
    const completionTokens = request.outputTokens;
    const cachedPctOfPrompt = promptContextTokens > 0 ? Math.round((promptCached / promptContextTokens) * 100) : 0;

    const prefix = th?.id ? `🧵 Thread ${th.id}: ` : 'Run: ';

    // Get persistent context info
    const persistentInfo = th?.id ? this.threadTokens.get(th.id) : null;
    const persistentTokens = persistentInfo?.persistentContextTokens || 0;
    const isSettled = persistentInfo ? !persistentInfo.hasToolsInCurrentRequest : false;

    // Line 1: Context and generation
    console.log(
      `${prefix}` +
      `context ${promptContextTokens.toLocaleString()} tokens | generated ${completionTokens.toLocaleString()} tokens`
    );

    // Line 2: Persistent context (if available)
    if (persistentInfo) {
      console.log(
        `${prefix}` +
        `├─ persistent ${persistentTokens.toLocaleString()} tokens` +
        (isSettled ? ' ✓ (settled)' : ' (tools active, not updated)')
      );
    }

    // Line 3: Cache breakdown
    if (cacheWriteTokens > 0) {
      // Show cache reads vs writes separately when we have writes
      console.log(
        `${prefix}` +
        `├─ cached ${cacheReadTokens.toLocaleString()} (${cachedPctOfPrompt}%) | fresh ${promptFresh.toLocaleString()} | cache writes ${cacheWriteTokens.toLocaleString()}`
      );
    } else {
      // Simpler output when no cache writes
      console.log(
        `${prefix}` +
        `├─ cached ${promptCached.toLocaleString()} (${cachedPctOfPrompt}%) | fresh ${promptFresh.toLocaleString()}`
      );
    }

    // Line 4: Cost analysis
    console.log(
      `${prefix}` +
      `└─ cost $${request.actualCostUSD.toFixed(4)} | saved $${request.costSavingsUSD.toFixed(4)} (${request.costReductionPercent}% reduction)`
    );
  }

  /**
   * Returns persistent context warning for a thread
   */
  getPersistentContextWarning(threadId: string): {
    level: 'none' | 'notice' | 'warning' | 'critical' | 'blocked';
    persistentTokens: number;
    message: string;
  } {
    const thread = this.threadTokens.get(threadId);
    if (!thread) {
      return { level: 'none', persistentTokens: 0, message: '' };
    }

    const tokens = thread.persistentContextTokens;
    let level: 'none' | 'notice' | 'warning' | 'critical' | 'blocked';
    let message: string;

    if (tokens > 100_000) {
      level = 'blocked';
      message = 'Context limit exceeded. Please start a new thread.';
    } else if (tokens > 95_000) {
      level = 'critical';
      message = 'Conversation approaching maximum context limit.';
    } else if (tokens > 85_000) {
      level = 'warning';
      message = 'Conversation context getting large. Consider starting a new thread soon.';
    } else if (tokens > 70_000) {
      level = 'notice';
      message = 'Conversation context is growing. Keep an eye on length.';
    } else {
      level = 'none';
      message = '';
    }

    return { level, persistentTokens: tokens, message };
  }

  /**
   * Returns current session metrics
   */
  getSessionMetrics(): SessionTokens {
    return { ...this.sessionTokens };
  }

  /**
   * Formats per-step token usage for console
   */
  formatStepTokens(stepIndex: number, totalTokens?: number): void {
    console.log(`\n==================== TOKENS (STEP ${stepIndex}) ====================`);
    console.log(`🧮 total: ${totalTokens ?? 'n/a'}`);
    console.log(`==================================================================`);
  }
}
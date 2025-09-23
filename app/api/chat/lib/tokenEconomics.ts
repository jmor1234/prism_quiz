// app/api/chat/lib/tokenEconomics.ts

/**
 * TokenEconomics tracks session-level token usage and calculates real USD costs
 * with Anthropic's caching discount model
 */

// Claude Sonnet 4 pricing (per million tokens)
const SONNET_4_INPUT_PRICE = 3.00;     // $3.00/MTok
const SONNET_4_CACHE_PRICE = 0.30;     // $0.30/MTok (90% discount)
const SONNET_4_OUTPUT_PRICE = 15.00;   // $15.00/MTok

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
}

interface AnthropicCacheMetadata {
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  [key: string]: unknown;
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
  updateFromEvent(event: EventWithMetadata, opts?: { threadId?: string }): CacheMetrics {
    // Extract token data
    const requestInputTokens = event.totalUsage?.inputTokens || 0;
    const requestOutputTokens = event.totalUsage?.outputTokens || 0;
    const requestTotalTokens = requestInputTokens + requestOutputTokens;

    // Extract cache metadata (prefer provider metadata; fall back to usage)
    const anthroMeta = event.providerMetadata?.anthropic;
    let cacheReadTokens = 0;
    let cacheCreateTokens = 0;

    if (
      anthroMeta &&
      (typeof anthroMeta.cache_read_input_tokens === 'number' ||
        typeof anthroMeta.cache_creation_input_tokens === 'number')
    ) {
      // Authoritative split when metadata present
      cacheReadTokens = anthroMeta.cache_read_input_tokens || 0;
      cacheCreateTokens = anthroMeta.cache_creation_input_tokens || 0;
    } else {
      // Fallback: treat usage.cachedInputTokens as cache reads only (unknown split)
      const usageCachedTokens = event.totalUsage?.cachedInputTokens || 0;
      cacheReadTokens = usageCachedTokens;
      cacheCreateTokens = 0;
    }

    // Total cached tokens counted for this request
    const effectiveCacheTokens = cacheReadTokens + cacheCreateTokens;

    // Calculate real costs in USD (cache reads and creations both cost the cache price)
    const freshInputCost = (requestInputTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
    const cacheReadCost = (cacheReadTokens / 1_000_000) * SONNET_4_CACHE_PRICE;
    const cacheCreateCost = (cacheCreateTokens / 1_000_000) * SONNET_4_CACHE_PRICE;
    const outputCost = (requestOutputTokens / 1_000_000) * SONNET_4_OUTPUT_PRICE;
    const totalCostWithCache = freshInputCost + cacheReadCost + cacheCreateCost + outputCost;

    // Cost without caching (all input at full price)
    const conversationContextTokens = requestInputTokens + effectiveCacheTokens;
    const allInputCost = (conversationContextTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
    const totalCostWithoutCache = allInputCost + outputCost;
    const realCostSavings = totalCostWithoutCache - totalCostWithCache;

    // Update session totals
    this.sessionTokens.totalRequests += 1;
    this.sessionTokens.totalInputTokens += requestInputTokens;
    this.sessionTokens.totalOutputTokens += requestOutputTokens;
    this.sessionTokens.totalTokens += requestTotalTokens;
    this.sessionTokens.totalCachedTokens += effectiveCacheTokens;
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
        };
        this.threadTokens.set(id, t);
      }
      t.totalRequests += 1;
      t.totalInputTokens += requestInputTokens;
      t.totalOutputTokens += requestOutputTokens;
      t.totalTokens += requestTotalTokens;
      t.totalCachedTokens += effectiveCacheTokens;
      t.totalContextTokens += conversationContextTokens;
      t.totalActualCost += totalCostWithCache;
      t.totalCostWithoutCache += totalCostWithoutCache;
      t.totalCostSavings += realCostSavings;

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
    const cacheMultiplier = requestInputTokens > 0 ? effectiveCacheTokens / requestInputTokens : 0;
    const trueCacheEfficiency = conversationContextTokens > 0 ? effectiveCacheTokens / conversationContextTokens : 0;

    // Session metrics
    const sessionTotalContextTokens = this.sessionTokens.totalInputTokens + this.sessionTokens.totalCachedTokens;
    const sessionCacheEfficiency = sessionTotalContextTokens > 0 ? this.sessionTokens.totalCachedTokens / sessionTotalContextTokens : 0;
    const sessionCacheMultiplier = this.sessionTokens.totalInputTokens > 0 ? this.sessionTokens.totalCachedTokens / this.sessionTokens.totalInputTokens : 0;
    const sessionUptime = Math.floor((Date.now() - this.sessionTokens.sessionStartTime.getTime()) / 1000 / 60);

    return {
      request: {
        inputTokens: requestInputTokens,
        outputTokens: requestOutputTokens,
        cachedTokens: effectiveCacheTokens,
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
      metadata: anthroMeta,
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

    if (th) {
      // Single concise line: cumulative tokens, current cached snapshot, per-run cost, and thread cumulative cost
      console.log(
        `🧵 Thread ${th.id}: ${th.totalTokens.toLocaleString()} tokens ` +
          `| ${request.cachedTokens.toLocaleString()} cached now (${request.trueCacheEfficiency}%) ` +
          `| run $${request.actualCostUSD.toFixed(4)} (saved $${request.costSavingsUSD.toFixed(4)} ${request.costReductionPercent}%) ` +
          `| thread $${th.actualCostUSD.toFixed(4)} (saved $${th.totalSavingsUSD.toFixed(4)} ${th.totalCostReductionPercent}%)`
      );
    } else {
      // Fallback to a compact request-level summary when thread id is unavailable
      const efficiency = request.conversationTokens > 0
        ? Math.round((request.cachedTokens / request.conversationTokens) * 100)
        : 0;
      console.log(
        `Run: ${request.totalTokens.toLocaleString()} tokens ` +
          `| ${request.cachedTokens.toLocaleString()} cached (${efficiency}%) ` +
          `| cost $${request.actualCostUSD.toFixed(4)} ` +
          `| saved $${request.costSavingsUSD.toFixed(4)} (${request.costReductionPercent}%)`
      );
    }
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
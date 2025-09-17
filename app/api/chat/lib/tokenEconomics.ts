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
}

export class TokenEconomics {
  private static instance: TokenEconomics;
  private sessionTokens: SessionTokens;

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
  updateFromEvent(event: EventWithMetadata): CacheMetrics {
    // Extract token data
    const requestInputTokens = event.totalUsage?.inputTokens || 0;
    const requestOutputTokens = event.totalUsage?.outputTokens || 0;
    const requestTotalTokens = requestInputTokens + requestOutputTokens;

    // Extract cache metadata (try both sources)
    const anthroMeta = event.providerMetadata?.anthropic;
    let cacheReadTokens = 0;
    let cacheCreateTokens = 0;

    if (anthroMeta) {
      cacheReadTokens = anthroMeta.cache_read_input_tokens || 0;
      cacheCreateTokens = anthroMeta.cache_creation_input_tokens || 0;
    }

    // Fallback: Use cachedInputTokens from usage (more reliable)
    const usageCachedTokens = event.totalUsage?.cachedInputTokens || 0;
    const effectiveCacheReadTokens = Math.max(cacheReadTokens, usageCachedTokens);

    // Include cache creation tokens in the total (happens on first request after cold start)
    const effectiveCacheTokens = effectiveCacheReadTokens + cacheCreateTokens;

    // Calculate real costs in USD (cache reads and creations both cost the cache price)
    const freshInputCost = (requestInputTokens / 1_000_000) * SONNET_4_INPUT_PRICE;
    const cacheReadCost = (effectiveCacheReadTokens / 1_000_000) * SONNET_4_CACHE_PRICE;
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
        costReductionPercent: Math.round((realCostSavings / totalCostWithoutCache) * 100 * 10) / 10,
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
        totalCostReductionPercent: Math.round((this.sessionTokens.totalCostSavings / this.sessionTokens.totalCostWithoutCache) * 100 * 10) / 10,
        uptimeMinutes: sessionUptime,
      },
      metadata: anthroMeta,
      cacheCreateTokens,
      cacheReadTokens: effectiveCacheReadTokens,
    };
  }

  /**
   * Formats and outputs cache metrics to console
   */
  formatConsoleOutput(metrics: CacheMetrics): void {
    const { request, session } = metrics;

    // Determine cache type (create vs read)
    const cacheType = metrics.cacheCreateTokens && metrics.cacheCreateTokens > 0 ? '🔨 Created' : '📦 Cached';

    console.log(`\n====================== TOKENS (RUN) =======================`);
    console.log(`💬 Current Conversation: ${request.conversationTokens.toLocaleString()} tokens (input context)`);
    console.log(`   ├─ ${cacheType}: ${request.cachedTokens.toLocaleString()} tokens (${request.trueCacheEfficiency}%)`);
    console.log(`   └─ 🆕 Fresh: ${request.inputTokens.toLocaleString()} tokens`);
    console.log(`📝 Output: ${request.outputTokens.toLocaleString()} tokens`);
    console.log(`📊 Session: ${session.totalRequests} requests, ${session.uptimeMinutes}min uptime`);

    console.log(`\n📦 CACHE PERFORMANCE:`);
    console.log(`   🔄 Cache Multiplier: ${request.cacheMultiplier}x (${request.cachedTokens.toLocaleString()} cached ÷ ${request.inputTokens.toLocaleString()} fresh)`);
    console.log(`   📊 True Efficiency: ${request.trueCacheEfficiency}% (${request.cachedTokens.toLocaleString()}/${request.conversationTokens.toLocaleString()} of conversation cached)`);
    console.log(`   📈 Session Efficiency: ${session.cacheEfficiency}% (${session.totalCachedTokens.toLocaleString()}/${session.totalContextTokens.toLocaleString()} total context cached)`);
    console.log(`   🔁 Session Multiplier: ${session.cacheMultiplier}x (${session.totalCachedTokens.toLocaleString()} cached ÷ ${session.totalInputTokens.toLocaleString()} fresh)`);

    console.log(`\n💰 REAL COSTS (Claude Sonnet 4):`);
    console.log(`   🔸 Request: $${request.actualCostUSD.toFixed(5)} (with cache) vs $${request.costWithoutCacheUSD.toFixed(5)} (without)`);
    console.log(`   💎 Session: $${session.actualCostUSD.toFixed(4)} (with cache) vs $${session.costWithoutCacheUSD.toFixed(4)} (without)`);
    console.log(`   🎯 Request Saved: $${request.costSavingsUSD.toFixed(5)} (${request.costReductionPercent}% cost reduction)`);
    console.log(`   🏆 Session Saved: $${session.totalSavingsUSD.toFixed(4)} (${session.totalCostReductionPercent}% total reduction)`);
    console.log(`   📚 Cache Activity: ${request.cachedTokens.toLocaleString()} tokens @ $${SONNET_4_CACHE_PRICE}/MTok`);
    console.log(`==========================================================`);
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
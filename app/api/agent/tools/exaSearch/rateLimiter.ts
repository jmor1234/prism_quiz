// app/api/agent/tools/exaSearch/rateLimiter.ts

/**
 * Promise-chained dispatch rate limiter.
 *
 * Controls when requests START (dispatch rate), but lets them EXECUTE concurrently.
 * Each call chains onto a pending dispatch promise, ensuring minimum interval between dispatches.
 *
 * No timers, no explicit queue — just promise chaining.
 */
export class RateLimiter {
  private lastDispatchTime = 0;
  private pendingDispatch: Promise<void> = Promise.resolve();
  private readonly intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const dispatch = this.pendingDispatch.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastDispatchTime;
      const waitMs = Math.max(0, this.intervalMs - elapsed);

      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }

      this.lastDispatchTime = Date.now();
    });

    // .catch prevents a broken dispatch from poisoning the entire chain
    this.pendingDispatch = dispatch.catch(() => {});

    await dispatch;
    return fn();
  }
}

function getConfiguredQps(): number {
  const envVal = process.env.EXA_RATE_LIMIT_QPS;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10; // 33% cushion below Exa's 15 QPS limit
}

export const exaRateLimiter = new RateLimiter(getConfiguredQps());

import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { getPhaseMaxAttempts, getPhaseTimeoutMs, getBaseBackoffMs, getMaxBackoffMs } from "@/app/api/chat/lib/retryConfig";

export type RetryPhase =
  | "queryGen"
  | "sqa"
  | "contentAnalysis"
  | "consolidation"
  | "finalSynthesis";

export interface RetryConfig {
  phase: RetryPhase;
  timeoutMs: number;
  maxAttempts?: number; // total attempts including the first
  baseBackoffMs?: number; // base for exponential backoff
  maxBackoffMs?: number; // cap for backoff
  isRetryable?: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatusCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const errObj = error as Record<string, unknown>;
    const candidates: unknown[] = [errObj["status"], errObj["code"]];

    const response = errObj["response"];
    if (typeof response === "object" && response !== null) {
      const respObj = response as Record<string, unknown>;
      candidates.push(respObj["status"]);
    }

    const cause = errObj["cause"];
    if (typeof cause === "object" && cause !== null) {
      const causeObj = cause as Record<string, unknown>;
      candidates.push(causeObj["status"]);
    }

    for (const c of candidates) {
      if (typeof c === "number") return c;
      if (typeof c === "string") {
        const n = Number(c);
        if (!Number.isNaN(n)) return n;
      }
    }
  }
  return undefined;
}

function defaultIsRetryable(error: unknown): boolean {
  const status = getErrorStatusCode(error);
  if (typeof status === "number") {
    if (status === 408 || status === 429) return true;
    if (status >= 500 && status < 600) return true;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  }
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  // Common transient/network signals
  return (
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("socket hang up") ||
    message.includes(" temporarily unavailable") ||
    message.includes("rate limit") ||
    message.includes("server error")
  );
}

/**
 * Executes an async call with a per-attempt timeout and bounded retries using exponential backoff with jitter.
 * The provided function receives an AbortSignal that will be aborted when the per-attempt timeout elapses.
 */
export async function withRetry<T>(
  call: (signal: AbortSignal) => Promise<T>,
  cfg: RetryConfig
): Promise<T> {
  const logger = getLogger();
  const maxAttempts = cfg.maxAttempts ?? getPhaseMaxAttempts(cfg.phase);
  const baseBackoffMs = cfg.baseBackoffMs ?? getBaseBackoffMs();
  const maxBackoffMs = cfg.maxBackoffMs ?? getMaxBackoffMs();
  const isRetryable = cfg.isRetryable ?? defaultIsRetryable;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Prefer native AbortSignal.timeout when available; fallback to AbortController
    let signal: AbortSignal;
    let timeoutHandle: NodeJS.Timeout | undefined = undefined;
    const AbortSignalWithTimeout = AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal };
    if (typeof AbortSignalWithTimeout?.timeout === "function") {
      signal = AbortSignalWithTimeout.timeout(cfg.timeoutMs ?? getPhaseTimeoutMs(cfg.phase));
    } else {
      const ac = new AbortController();
      const t = cfg.timeoutMs ?? getPhaseTimeoutMs(cfg.phase);
      timeoutHandle = setTimeout(() => ac.abort(), t);
      signal = ac.signal;
    }

    const start = Date.now();
    try {
      const result = await call(signal);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (attempt > 1) {
        logger?.logToolInternalStep("llm_retry", "SUCCESS_AFTER_RETRY", {
          phase: cfg.phase,
          attempts: attempt,
          duration_ms: Date.now() - start,
        });
      }
      // Aggregate: attempts (always) and retries (if >1)
      logger?.incrementRetryStat(cfg.phase, 'attempts');
      if (attempt > 1) logger?.incrementRetryStat(cfg.phase, 'retries');
      return result;
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      lastError = error;
      const duration = Date.now() - start;
      const retryable = isRetryable(error);

      // Best-effort extraction of Retry-After header (seconds) for 429s
      let retryAfterMs: number | undefined = undefined;
      if (typeof error === "object" && error !== null) {
        const errObj = error as Record<string, unknown>;
        const candidates: Array<Record<string, unknown>> = [];
        const response = errObj["response"];
        if (typeof response === "object" && response !== null) {
          const respObj = response as Record<string, unknown>;
          if (typeof respObj["headers"] === "object" && respObj["headers"] !== null) {
            candidates.push(respObj["headers"] as Record<string, unknown>);
          }
        }
        if (typeof errObj["headers"] === "object" && errObj["headers"] !== null) {
          candidates.push(errObj["headers"] as Record<string, unknown>);
        }
        for (const headers of candidates) {
          const ra = headers["retry-after"];
          if (typeof ra === "string" || typeof ra === "number") {
            const sec = typeof ra === "number" ? ra : Number(ra);
            if (!Number.isNaN(sec)) {
              retryAfterMs = Math.min(sec * 1000, maxBackoffMs);
              break;
            }
          }
        }
      }

      logger?.logToolInternalStep("llm_retry", "ATTEMPT_FAILED", {
        phase: cfg.phase,
        attempt,
        retryable,
        duration_ms: duration,
        status: getErrorStatusCode(error),
        error: error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) },
      });

      // Aggregate timeout detection (AbortError or message text), and attempts
      logger?.incrementRetryStat(cfg.phase, 'attempts');
      const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
      if (msg.includes('abort') || msg.includes('timeout') || msg.includes('etimedout')) {
        logger?.incrementRetryStat(cfg.phase, 'timeouts');
      }

      if (attempt === maxAttempts || !retryable) {
        if (attempt === maxAttempts && retryable) {
          logger?.incrementRetryStat(cfg.phase, 'maxAttemptsExhausted');
        }
        break;
      }

      // Exponential backoff with full jitter; respect Retry-After if present
      const rawBackoff = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt - 1));
      const backoffBase = retryAfterMs ?? rawBackoff;
      const waitMs = Math.floor(Math.random() * backoffBase);
      await sleep(waitMs);
    }
  }

  throw lastError;
}



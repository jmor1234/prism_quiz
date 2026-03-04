// app/api/agent/lib/llmRetry.ts

import { type Phase, getPhaseConfig } from "./retryConfig";

interface ClassifiedError {
  retryable: boolean;
  retryAfterMs?: number;
}

function classifyError(error: unknown): ClassifiedError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return { retryable: true };
  }

  if (
    error instanceof Error &&
    "name" in error &&
    error.name === "TimeoutError"
  ) {
    return { retryable: true };
  }

  // Handle API errors with status codes
  const status = getStatusCode(error);
  if (status !== undefined) {
    if (status === 429) {
      const retryAfter = getRetryAfterMs(error);
      return { retryable: true, retryAfterMs: retryAfter };
    }
    if (status >= 500) return { retryable: true };
    // 4xx (except 429) are not retryable
    return { retryable: false };
  }

  // Network errors are retryable
  if (error instanceof TypeError && error.message.includes("fetch")) {
    return { retryable: true };
  }

  return { retryable: false };
}

function getStatusCode(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as Record<string, unknown>).status === "number"
  ) {
    return (error as Record<string, unknown>).status as number;
  }
  return undefined;
}

function getRetryAfterMs(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "headers" in error &&
    typeof (error as Record<string, unknown>).headers === "object"
  ) {
    const headers = (error as Record<string, unknown>).headers as Record<
      string,
      string
    > | null;
    const retryAfter = headers?.["retry-after"];
    if (retryAfter) {
      const seconds = parseFloat(retryAfter);
      if (!Number.isNaN(seconds)) return seconds * 1000;
    }
  }
  return undefined;
}

function backoffMs(baseDelay: number, attempt: number): number {
  const exponential = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelay;
  return exponential + jitter;
}

export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  phase: Phase
): Promise<T> {
  const config = getPhaseConfig(phase);

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      try {
        const result = await fn(controller.signal);
        return result;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      const classified = classifyError(error);
      const isLastAttempt = attempt === config.maxAttempts - 1;

      if (!classified.retryable || isLastAttempt) {
        throw error;
      }

      const delay =
        classified.retryAfterMs ?? backoffMs(config.baseDelayMs, attempt);
      console.warn(
        `[${phase}] Attempt ${attempt + 1}/${config.maxAttempts} failed, retrying in ${Math.round(delay)}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error(`[${phase}] All ${config.maxAttempts} attempts exhausted`);
}

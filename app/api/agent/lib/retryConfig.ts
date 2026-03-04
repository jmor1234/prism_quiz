// app/api/agent/lib/retryConfig.ts

export type Phase = "extraction";

export interface PhaseConfig {
  timeoutMs: number;
  maxAttempts: number;
  baseDelayMs: number;
}

const defaults: Record<Phase, PhaseConfig> = {
  extraction: { timeoutMs: 25_000, maxAttempts: 2, baseDelayMs: 1_000 },
};

function envInt(key: string): number | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getPhaseConfig(phase: Phase): PhaseConfig {
  const d = defaults[phase];
  const prefix = `RETRY_${phase.toUpperCase()}`;
  return {
    timeoutMs: envInt(`${prefix}_TIMEOUT_MS`) ?? d.timeoutMs,
    maxAttempts: envInt(`${prefix}_MAX_ATTEMPTS`) ?? d.maxAttempts,
    baseDelayMs: envInt(`${prefix}_BASE_DELAY_MS`) ?? d.baseDelayMs,
  };
}

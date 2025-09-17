export type RetryPhase =
  | 'queryGen'
  | 'sqa'
  | 'contentAnalysis'
  | 'consolidation'
  | 'finalSynthesis';

function readNumberEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULT_TIMEOUTS: Record<RetryPhase, number> = {
  queryGen: 20_000,
  sqa: 10_000,
  contentAnalysis: 25_000,
  consolidation: 15_000,
  finalSynthesis: 45_000, // Increased for complex synthesis
};

const PHASE_TIMEOUT_ENV: Record<RetryPhase, string> = {
  queryGen: 'LLM_TIMEOUT_QUERY_GEN_MS',
  sqa: 'LLM_TIMEOUT_SQA_MS',
  contentAnalysis: 'LLM_TIMEOUT_CONTENT_ANALYSIS_MS',
  consolidation: 'LLM_TIMEOUT_CONSOLIDATION_MS',
  finalSynthesis: 'LLM_TIMEOUT_FINAL_SYNTHESIS_MS',
};

const PHASE_ATTEMPTS_ENV: Record<RetryPhase, string> = {
  queryGen: 'LLM_RETRY_MAX_ATTEMPTS_QUERY_GEN',
  sqa: 'LLM_RETRY_MAX_ATTEMPTS_SQA',
  contentAnalysis: 'LLM_RETRY_MAX_ATTEMPTS_CONTENT_ANALYSIS',
  consolidation: 'LLM_RETRY_MAX_ATTEMPTS_CONSOLIDATION',
  finalSynthesis: 'LLM_RETRY_MAX_ATTEMPTS_FINAL_SYNTHESIS',
};

export function getPhaseTimeoutMs(phase: RetryPhase): number {
  const envName = PHASE_TIMEOUT_ENV[phase];
  return readNumberEnv(envName, DEFAULT_TIMEOUTS[phase]);
}

export function getPhaseMaxAttempts(phase: RetryPhase): number {
  const globalDefault = readNumberEnv('LLM_RETRY_MAX_ATTEMPTS', 3);
  const envName = PHASE_ATTEMPTS_ENV[phase];
  return readNumberEnv(envName, globalDefault);
}

export function getBaseBackoffMs(): number {
  return readNumberEnv('LLM_RETRY_BASE_BACKOFF_MS', 500);
}

export function getMaxBackoffMs(): number {
  return readNumberEnv('LLM_RETRY_MAX_BACKOFF_MS', 8000);
}



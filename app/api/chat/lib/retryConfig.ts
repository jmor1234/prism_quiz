export type RetryPhase =
  | 'queryGen'
  | 'sqa'
  | 'contentAnalysis'
  | 'consolidation'
  | 'finalSynthesis'
  | 'citationQueryGen'
  | 'citationCuration'
  | 'analyzeExistingLabs'
  | 'recommendDiagnostics'
  | 'recommendDietLifestyle'
  | 'recommendSupplements';

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
  finalSynthesis: 60_000, // Increased for complex synthesis
  citationQueryGen: 10_000,
  citationCuration: 30_000,
  analyzeExistingLabs: 60_000,
  recommendDiagnostics: 20_000,
  recommendDietLifestyle: 20_000,
  recommendSupplements: 20_000,
};

const PHASE_TIMEOUT_ENV: Record<RetryPhase, string> = {
  queryGen: 'LLM_TIMEOUT_QUERY_GEN_MS',
  sqa: 'LLM_TIMEOUT_SQA_MS',
  contentAnalysis: 'LLM_TIMEOUT_CONTENT_ANALYSIS_MS',
  consolidation: 'LLM_TIMEOUT_CONSOLIDATION_MS',
  finalSynthesis: 'LLM_TIMEOUT_FINAL_SYNTHESIS_MS',
  citationQueryGen: 'LLM_TIMEOUT_CITATION_QUERY_GEN_MS',
  citationCuration: 'LLM_TIMEOUT_CITATION_CURATION_MS',
  analyzeExistingLabs: 'LLM_TIMEOUT_ANALYZE_EXISTING_LABS_MS',
  recommendDiagnostics: 'LLM_TIMEOUT_RECOMMEND_DIAGNOSTICS_MS',
  recommendDietLifestyle: 'LLM_TIMEOUT_RECOMMEND_DIET_LIFESTYLE_MS',
  recommendSupplements: 'LLM_TIMEOUT_RECOMMEND_SUPPLEMENTS_MS',
};

const PHASE_ATTEMPTS_ENV: Record<RetryPhase, string> = {
  queryGen: 'LLM_RETRY_MAX_ATTEMPTS_QUERY_GEN',
  sqa: 'LLM_RETRY_MAX_ATTEMPTS_SQA',
  contentAnalysis: 'LLM_RETRY_MAX_ATTEMPTS_CONTENT_ANALYSIS',
  consolidation: 'LLM_RETRY_MAX_ATTEMPTS_CONSOLIDATION',
  finalSynthesis: 'LLM_RETRY_MAX_ATTEMPTS_FINAL_SYNTHESIS',
  citationQueryGen: 'LLM_RETRY_MAX_ATTEMPTS_CITATION_QUERY_GEN',
  citationCuration: 'LLM_RETRY_MAX_ATTEMPTS_CITATION_CURATION',
  analyzeExistingLabs: 'LLM_RETRY_MAX_ATTEMPTS_ANALYZE_EXISTING_LABS',
  recommendDiagnostics: 'LLM_RETRY_MAX_ATTEMPTS_RECOMMEND_DIAGNOSTICS',
  recommendDietLifestyle: 'LLM_RETRY_MAX_ATTEMPTS_RECOMMEND_DIET_LIFESTYLE',
  recommendSupplements: 'LLM_RETRY_MAX_ATTEMPTS_RECOMMEND_SUPPLEMENTS',
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



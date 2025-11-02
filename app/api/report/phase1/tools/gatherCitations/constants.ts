// app/api/report/phase1/tools/gatherCitations/constants.ts

export const DEFAULT_START_DATE = "2015-01-01"; // Last 10 years of research
export const RESULTS_PER_QUERY = 5; // Optimized queries enable smaller result set per query
export const MAX_CITATIONS_PER_SUBSUBSECTION = 6; // Up to 6 curated citations per semantic pattern
export const CONCURRENT_SEARCH_LIMIT = 8; // Match chat route batch size - actual rate limiting (12.5 QPS) handled by global exaRateLimiter
export const CURATION_MODEL = "gemini-2.5-flash-lite-preview-09-2025";
export const QUERY_GENERATION_MODEL = "gemini-2.5-flash-lite-preview-09-2025";

// Trusted academic domains (available for future optional filtering)
// Currently unused - relying on Exa's "research paper" category classification
// and neural ranking to naturally prioritize quality sources
export const TRUSTED_ACADEMIC_DOMAINS = [
  "pubmed.ncbi.nlm.nih.gov",
  "nih.gov",
  "arxiv.org",
  "nature.com",
  "science.org",
  "cell.com",
  "thelancet.com",
  "bmj.com",
  "nejm.org",
  "sciencedirect.com",
  "springer.com",
  "wiley.com",
  "oxford.com",
  "cambridge.org",
  "frontiersin.org",
  "mdpi.com",
  "plos.org",
] as const;

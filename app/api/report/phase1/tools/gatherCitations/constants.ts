// app/api/report/phase1/tools/gatherCitations/constants.ts

export const DEFAULT_START_DATE = "2015-01-01"; // Last 10 years of research
export const RESULTS_PER_TOPIC = 10; // Comprehensive gathering per topic
export const CITATIONS_PER_SUBSECTION = 10; // Curated output per subsection
export const CONCURRENT_SEARCH_LIMIT = 12; // Exa rate limit allows 12 QPS comfortably
export const CURATION_MODEL = "gemini-2.5-flash-preview-09-2025";

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

// app/api/agent/tools/exaSearch/types.ts

export interface ExaSearchResult {
  url: string;
  title: string;
  publishedDate: string | null;
  author: string | null;
  highlights: string[];
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
  costDollars: number;
}

export interface SearchOptions {
  includeText?: string;
  excludeText?: string;
  numResults?: number;
  /** null = no category filter, undefined = default 'research paper' */
  category?: string | null;
}

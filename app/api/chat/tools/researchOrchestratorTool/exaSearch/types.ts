import { EXA_CATEGORIES, ExaCategory as OriginalExaCategory } from "../constants";

export type ExaCategory = OriginalExaCategory;
export { EXA_CATEGORIES };

export interface ExaSearchConfig {
  query: string;
  type: 'keyword' | 'neural';
  numResults: number;
  category?: ExaCategory;
  startPublishedDate?: string; // YYYY-MM-DD
  endPublishedDate?: string;   // YYYY-MM-DD
}

export interface ExaSearchHit {
  url: string;
  title?: string | null;
  publishedDate?: string;
  author?: string;
  exaScore?: number;
}

export interface SingleExaQueryOutcome {
  focusedObjective: string;
  originalQuery: string;
  queryType: 'keyword' | 'neural';
  configUsed: ExaSearchConfig;
  success: boolean;
  results?: ExaSearchHit[];
  error?: { message: string; name?: string; details?: unknown };
}



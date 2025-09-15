export interface ExtractionTarget {
  url: string;
  objective: string;
  crawlOptions?: CrawlOptions;
}

export interface ExtractionRequest {
  extractionTargets: ExtractionTarget[];
  globalObjective?: string; // Optional global context
}

export interface CrawlOptions {
  subpages?: number;
  subpageTargets?: string[];
}

export interface ExtractionResult {
  url: string;
  success: boolean;
  extractedData?: ExtractedData;
  error?: string;
}

export interface ExtractedData {
  findings: Finding[];
  summary: string;
  additionalContext?: string;
}

export interface Finding {
  insight: string;
  evidence: string;
  relevance: string;
}

export interface ExtractionSummary {
  totalUrls: number;
  successfulExtractions: number;
  failedExtractions: number;
  results: ExtractionResult[];
  consolidatedFindings: string;
}

// Types for extraction agent
export interface ExtractionAgentInput {
  url: string;
  fullText: string;
  objective: string;
}

export type ExtractionAgentOutput = ExtractedData;



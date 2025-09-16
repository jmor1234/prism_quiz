export interface ContentAnalysisAgentInput {
  url: string;
  fullText: string;
  focusedObjective: string;
  focusAreas: string[];
  keyEntities: string[];
  documentPublishedDate?: string;
  currentDate: string;
}

export interface ContentAnalysisAgentOutput {
  findings?: Array<{
    insight: string;
    supportingExcerpts: string[];
    addressedObjectives: string[];
  }>;
  newlyIdentifiedRelevantEntities?: Array<{
    entity: string;
    relevanceExplanation: string;
    relatedSubObjectives?: string[];
  }>;
  summaryOfAnalysis: string;
}

export interface AnalyzedDocument extends ContentAnalysisAgentOutput {
  url: string;
  focusedObjective: string;
  documentPublishedDate?: string;
}



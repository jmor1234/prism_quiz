import { AnalyzedDocument } from '../contentAnalysis/types';

export interface ResearchConsolidationAgentInput {
  analyzedDocument: AnalyzedDocument;
  focusedObjective: string;
  focusAreas: string[];
  keyEntities: string[];
  currentDate: string;
}



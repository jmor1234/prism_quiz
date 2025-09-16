export interface SQAInput {
  url: string;
  fullText: string;
  title?: string | null;
  focusedObjective: string;
  focusAreas: string[];
  keyEntities: string[];
  publishedDate?: string;
  currentDate: string;
}

export interface SQAOutput {
  url: string;
  title?: string | null;
  isHighSignal: boolean;
  rationale: string;
  focusedObjective: string;
  publishedDate?: string;
  fullText: string;
}



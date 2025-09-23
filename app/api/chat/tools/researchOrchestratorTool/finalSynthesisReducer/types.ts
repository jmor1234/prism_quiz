import type { ResearchPlan } from '../researchStrategy/schema';

export interface FinalSynthesisReducerInput {
  groupReports: Array<{
    finalDocument: string;
    claimSpans: { anchor: string; start: number; end: number; sources: string[]; quote?: string }[];
  }>;
  researchPlan: ResearchPlan;
  currentDate: string;
}

export interface FinalSynthesisReducerOutput {
  thinking: string;
  finalDocument: string;
  claimSpans: { anchor: string; start: number; end: number; sources: string[]; quote?: string }[];
}



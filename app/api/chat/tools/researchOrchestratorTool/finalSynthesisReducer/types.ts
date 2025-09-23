import type { ResearchPlan } from '../researchStrategy/schema';

export interface FinalSynthesisReducerInput {
  groupReports: Array<{
    finalDocument: string;
  }>;
  researchPlan: ResearchPlan;
  currentDate: string;
}

export interface FinalSynthesisReducerOutput {
  finalDocument: string;
}



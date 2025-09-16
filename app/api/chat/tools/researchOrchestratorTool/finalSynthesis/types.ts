import { ConsolidatedDocument } from '../researchConsolidation/schema';
import { ResearchPlan } from '../researchStrategy/schema';

export interface FinalSynthesisAgentInput {
  consolidatedDocuments: ConsolidatedDocument[];
  researchPlan: ResearchPlan;
  currentDate: string;
}



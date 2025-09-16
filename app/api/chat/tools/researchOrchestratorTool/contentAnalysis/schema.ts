import { z } from 'zod';

const findingSchema = z.object({
  insight: z.string(),
  supportingExcerpts: z.array(z.string()).min(1),
  addressedObjectives: z.array(z.string()).min(1),
});

const newlyIdentifiedEntitySchema = z.object({
  entity: z.string(),
  relevanceExplanation: z.string(),
  relatedSubObjectives: z.array(z.string()).optional(),
});

export const contentAnalysisAgentOutputSchema = z.object({
  findings: z.array(findingSchema).optional(),
  newlyIdentifiedRelevantEntities: z.array(newlyIdentifiedEntitySchema).optional(),
  summaryOfAnalysis: z.string(),
});

export type ContentAnalysisAgentOutput = z.infer<typeof contentAnalysisAgentOutputSchema>;



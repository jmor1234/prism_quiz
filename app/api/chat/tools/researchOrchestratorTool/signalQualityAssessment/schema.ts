import { z } from 'zod';

export const sqaAssessmentSchema = z.object({
  isHighSignal: z.boolean().describe(
    'Set to true if the document provides strong, relevant signal for the research objective.'
  ),
  rationale: z.string().describe(
    "Explanation for the relevance assessment; why the document is or isn't relevant."
  ),
});

export type SqaAssessment = z.infer<typeof sqaAssessmentSchema>;



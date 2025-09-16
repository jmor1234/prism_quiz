import { z } from 'zod';

export const consolidatedDocumentSchema = z.object({
  url: z.string(),
  primaryContribution: z.string(),
  essentialFindings: z.array(
    z.object({
      finding: z.string(),
      evidence: z.string(),
      significance: z.string(),
    })
  ),
  addressedObjectives: z.string(),
});

export type ConsolidatedDocument = z.infer<typeof consolidatedDocumentSchema>;



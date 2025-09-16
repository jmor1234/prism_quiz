import { z } from 'zod';

export const finalSynthesisAgentOutputSchema = z.object({
  reportOutline: z.string(),
  finalDocument: z.string(),
});

export type FinalSynthesisAgentOutput = z.infer<typeof finalSynthesisAgentOutputSchema>;



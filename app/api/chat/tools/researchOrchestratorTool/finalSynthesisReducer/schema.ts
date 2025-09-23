import { z } from 'zod';

export const finalSynthesisReducerOutputSchema = z.object({
  thinking: z.string(),
  finalDocument: z.string(),
  claimSpans: z
    .array(
      z.object({
        anchor: z.string(),
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative(),
        sources: z.array(z.string().url()).min(1),
        quote: z.string().optional(),
      })
    )
    .default([]),
});

export type FinalSynthesisReducerOutput = z.infer<typeof finalSynthesisReducerOutputSchema>;



// app/api/report/phase1/tools/gatherCitations/queryGeneration/schema.ts

import { z } from "zod";

export const citationQueryGenerationOutputSchema = z.object({
  queryStrategy: z
    .string()
    .describe(
      "Brief explanation of the query approach and why these queries will find relevant academic papers for this pattern"
    ),
  queries: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe(
      "Optimized neural queries for Exa search (2-4 queries depending on pattern complexity)"
    ),
});

export type CitationQueryGenerationOutput = z.infer<
  typeof citationQueryGenerationOutputSchema
>;

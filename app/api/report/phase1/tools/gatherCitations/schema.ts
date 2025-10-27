// app/api/report/phase1/tools/gatherCitations/schema.ts

import { z } from "zod";

// Input schema
export const gatherCitationsInputSchema = z.object({
  citationRequests: z
    .array(
      z.object({
        subsection: z
          .string()
          .describe(
            "Primary report section (e.g., 'Assessment Findings', 'Supplement Recommendations')"
          ),
        subsubsections: z
          .array(
            z.object({
              name: z
                .string()
                .describe(
                  "Semantic pattern or conceptual grouping within this section"
                ),
              summary: z
                .string()
                .describe(
                  "Brief summary of findings or mechanisms discussed for this pattern"
                ),
              entities: z
                .array(z.string())
                .min(1)
                .describe(
                  "Key technical terms and entities discussed in this pattern (e.g., TSH, T3, glucose, cortisol)"
                ),
            })
          )
          .min(1)
          .describe(
            "Semantic groupings within this section, each with context for query generation"
          ),
      })
    )
    .min(1)
    .describe(
      "Citation requests organized hierarchically by subsection and semantic pattern"
    ),
});

// Output schema
export const gatherCitationsOutputSchema = z.object({
  acknowledged: z
    .literal(true)
    .describe("Confirmation that citations have been gathered and stored"),
  citationCount: z
    .number()
    .describe("Total number of citations gathered"),
});

export type GatherCitationsInput = z.infer<typeof gatherCitationsInputSchema>;
export type GatherCitationsOutput = z.infer<typeof gatherCitationsOutputSchema>;

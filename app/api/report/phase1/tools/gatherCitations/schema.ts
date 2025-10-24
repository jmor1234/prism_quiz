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
            "References subsection name (e.g., 'Assessment Findings', 'Supplement Recommendations')"
          ),
        topics: z
          .array(z.string())
          .min(1)
          .describe(
            "Specific research topics or mechanisms to find academic citations for"
          ),
      })
    )
    .min(1)
    .describe(
      "Citation requests organized by References subsection"
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

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
  citationsBySubsection: z
    .record(
      z.string(),
      z.array(
        z.object({
          title: z.string().describe("Paper title"),
          author: z.string().optional().describe("Author(s) if available"),
          publishedDate: z
            .string()
            .optional()
            .describe("Publication date if available"),
          url: z.string().describe("Full URL to the paper"),
        })
      )
    )
    .describe(
      "Citations organized by subsection, ready for References formatting"
    ),
  totalCitations: z
    .number()
    .describe("Total number of citations gathered across all subsections"),
  uniqueCitations: z
    .number()
    .describe("Number of unique citations after deduplication"),
});

export type GatherCitationsInput = z.infer<typeof gatherCitationsInputSchema>;
export type GatherCitationsOutput = z.infer<typeof gatherCitationsOutputSchema>;

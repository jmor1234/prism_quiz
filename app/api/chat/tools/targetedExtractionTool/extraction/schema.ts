import { z } from 'zod';

export const extractionOutputSchema = z.object({
  findings: z
    .array(
      z.object({
        insight: z.string().describe("Key information discovered"),
        evidence: z.string().describe("Supporting details or quotes from the source"),
        relevance: z.string().describe("How this relates to the extraction objective"),
      })
    )
    .describe("Extracted insights relevant to the objective"),

  summary: z.string().describe("Concise synthesis of all findings from this source"),

  additionalContext: z
    .string()
    .optional()
    .describe(
      "Any important context, limitations, or caveats about the extracted information"
    ),
});



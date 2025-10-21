// app/api/report/phase1/tools/recommendSupplements/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const recommendSupplementsInputSchema = z.object({
  requestedItem: z
    .string()
    .describe("Specific supplement/pharmaceutical from directives (e.g., 'magnesium glycinate' or 'thyroid support')"),

  clientContext: z
    .object({
      age: z.number().optional().describe("Client age"),
      gender: z.string().optional().describe("Client gender"),
      primaryConcerns: z
        .array(z.string())
        .describe("Top symptoms or issues"),
      constraints: z
        .array(z.string())
        .optional()
        .describe("Relevant limitations"),
    })
    .describe("Client personalization factors"),

  objective: z
    .string()
    .describe("Strategic guidance for this specific supplement"),
});

// Output schema: wrapper object containing union for specific vs ambiguous matches
export const recommendSupplementsOutputSchema = z.object({
  match: z.union([
    // Specific match found
    z.object({
      type: z.literal("specific"),
      recommendation: z.object({
        supplement: z.string().describe("Full supplement/pharmaceutical name from database"),
        rationale: z.string().describe("Why this supplement addresses the directive, personalized to client"),
        dosage: z.string().describe("Dosage instructions from database"),
        source: z.string().describe("Where to purchase (include discount codes if present in database)"),
        rootCauseAddressed: z.string().describe("The underlying issue this supplement targets"),
      }),
    }),
    // Multiple potential matches - return options
    z.object({
      type: z.literal("options"),
      options: z
        .array(
          z.object({
            supplement: z.string().describe("Full supplement/pharmaceutical name from database"),
            rationale: z.string().describe("Why this could match the directive"),
            dosage: z.string().describe("Dosage instructions from database"),
            source: z.string().describe("Where to purchase (include discount codes if present in database)"),
            rootCauseAddressed: z.string().describe("The underlying issue this supplement targets"),
          })
        )
        .max(5)
        .min(2)
        .describe("2-5 potential matches when directive is ambiguous"),
      reasoning: z.string().describe("Why these options were selected and how they differ"),
    }),
  ]),
});

export type RecommendSupplementsInput = z.infer<typeof recommendSupplementsInputSchema>;
type RecommendSupplementsOutputWrapper = z.infer<typeof recommendSupplementsOutputSchema>;
export type RecommendSupplementsOutput = RecommendSupplementsOutputWrapper["match"];

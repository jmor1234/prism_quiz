// app/api/report/phase1/tools/recommendDietLifestyle/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const recommendDietLifestyleInputSchema = z.object({
  requestedItem: z
    .string()
    .describe("Specific diet/lifestyle intervention from directives (e.g., 'increase salt intake' or 'stress management')"),

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
    .describe("Strategic guidance for this specific intervention"),
});

// Output schema: wrapper object containing union for specific vs ambiguous matches
export const recommendDietLifestyleOutputSchema = z.object({
  match: z.union([
    // Specific match found
    z.object({
      type: z.literal("specific"),
      recommendation: z.object({
        intervention: z.string().describe("Full intervention name from database"),
        rationale: z.string().describe("Why this intervention addresses the directive, personalized to client"),
        implementation: z.string().describe("How to implement this intervention (from database)"),
        rootCauseAddressed: z.string().describe("The underlying issue this intervention targets"),
      }),
    }),
    // Multiple potential matches - return options
    z.object({
      type: z.literal("options"),
      options: z
        .array(
          z.object({
            intervention: z.string().describe("Full intervention name from database"),
            rationale: z.string().describe("Why this could match the directive"),
            implementation: z.string().describe("How to implement this intervention (from database)"),
            rootCauseAddressed: z.string().describe("The underlying issue this intervention targets"),
          })
        )
        .max(5)
        .min(2)
        .describe("2-5 potential matches when directive is ambiguous"),
      reasoning: z.string().describe("Why these options were selected and how they differ"),
    }),
  ]),
});

export type RecommendDietLifestyleInput = z.infer<typeof recommendDietLifestyleInputSchema>;
type RecommendDietLifestyleOutputWrapper = z.infer<typeof recommendDietLifestyleOutputSchema>;
export type RecommendDietLifestyleOutput = RecommendDietLifestyleOutputWrapper["match"];

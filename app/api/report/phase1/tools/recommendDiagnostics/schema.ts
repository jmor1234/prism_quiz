// app/api/report/phase1/tools/recommendDiagnostics/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const recommendDiagnosticsInputSchema = z.object({
  requestedItem: z
    .string()
    .describe("Specific diagnostic name or category from directives (e.g., 'comprehensive stool test' or 'thyroid panel')"),

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
        .describe("Relevant limitations (e.g., 'budget-conscious')"),
    })
    .describe("Client personalization factors"),

  objective: z
    .string()
    .describe("Strategic guidance for this specific diagnostic"),
});

// Output schema: wrapper object containing union for specific vs ambiguous matches
export const recommendDiagnosticsOutputSchema = z.object({
  match: z.union([
    // Specific match found
    z.object({
      type: z.literal("specific"),
      recommendation: z.object({
        diagnostic: z.string().describe("Full diagnostic name from database"),
        rationale: z.string().describe("Why this test addresses the directive, personalized to client"),
        rootCauseAddressed: z.string().describe("The underlying issue this diagnostic investigates"),
        whereToGet: z.string().describe("Provider or lab source (empty string if not available in database)"),
      }),
    }),
    // Multiple potential matches - return options
    z.object({
      type: z.literal("options"),
      options: z
        .array(
          z.object({
            diagnostic: z.string().describe("Full diagnostic name from database"),
            rationale: z.string().describe("Why this could match the directive"),
            rootCauseAddressed: z.string().describe("The underlying issue this diagnostic investigates"),
            whereToGet: z.string().describe("Provider or lab source (empty string if not available in database)"),
          })
        )
        .max(5)
        .min(2)
        .describe("2-5 potential matches when directive is ambiguous"),
      reasoning: z.string().describe("Why these options were selected and how they differ"),
    }),
  ]),
});

export type RecommendDiagnosticsInput = z.infer<typeof recommendDiagnosticsInputSchema>;
type RecommendDiagnosticsOutputWrapper = z.infer<typeof recommendDiagnosticsOutputSchema>;
export type RecommendDiagnosticsOutput = RecommendDiagnosticsOutputWrapper["match"];

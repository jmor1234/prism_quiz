// app/api/report/phase1/tools/recommendDietLifestyle/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const recommendDietLifestyleInputSchema = z.object({
  rootCauses: z
    .array(
      z.object({
        name: z
          .string()
          .describe("Specific root cause identified (e.g., 'Small intestinal bacterial overgrowth')"),
        category: z
          .enum(["gut", "stress", "thyroid"])
          .describe("Which of the three pillars this root cause falls under"),
        evidence: z
          .array(z.string())
          .describe("Key data points from client data supporting this root cause"),
        mechanism: z
          .string()
          .describe("Brief explanation of the bioenergetic cascade"),
        severity: z
          .enum(["high", "moderate"])
          .describe("Severity assessment based on evidence strength and symptom impact"),
      })
    )
    .describe("Array of identified root causes with comprehensive context"),

  clientContext: z
    .object({
      age: z.number().optional().describe("Client age for intervention appropriateness"),
      gender: z.string().optional().describe("Gender for gender-specific interventions"),
      primaryConcerns: z
        .array(z.string())
        .describe("Top symptoms bothering client most - prioritize interventions addressing these"),
      constraints: z
        .array(z.string())
        .optional()
        .describe("Relevant limitations (e.g., 'budget-conscious', 'minimal lifestyle changes')"),
    })
    .describe("Client context for personalization and prioritization"),

  objective: z
    .string()
    .describe("Primary agent's strategic guidance for diet & lifestyle recommendations"),
});

// Output schema: what the sub-agent returns
export const recommendDietLifestyleOutputSchema = z.object({
  recommendations: z
    .array(
      z.object({
        intervention: z
          .string()
          .describe("The diet or lifestyle intervention from CSV database"),
        rationale: z
          .string()
          .describe("Explicit connection to root cause - how this creates meaningful impact"),
        rootCauseAddressed: z
          .string()
          .describe("Which specific root cause this intervention targets"),
        notes: z
          .string()
          .optional()
          .describe("Implementation guidance, personalization details, or important context from database"),
      })
    )
    .max(7)
    .min(1)
    .describe(
      "Maximum 7 highest-impact interventions. Select for clear root cause impact, not comprehensiveness."
    ),
});

export type RecommendDietLifestyleInput = z.infer<typeof recommendDietLifestyleInputSchema>;
export type RecommendDietLifestyleOutput = z.infer<typeof recommendDietLifestyleOutputSchema>;

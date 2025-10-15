// app/api/report/phase1/tools/recommendDiagnostics/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const recommendDiagnosticsInputSchema = z.object({
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
        .describe("Relevant limitations (e.g., 'budget-conscious', 'minimal test load')"),
    })
    .describe("Client context for personalization and prioritization"),

  objective: z
    .string()
    .describe("Primary agent's strategic guidance for diagnostic recommendations"),
});

// Output schema: what the sub-agent returns
export const recommendDiagnosticsOutputSchema = z.object({
  recommendations: z
    .array(
      z.object({
        diagnostic: z
          .string()
          .describe("The diagnostic test from CSV database"),
        rationale: z
          .string()
          .describe("Explicit connection to root cause - how this test provides meaningful insight"),
        rootCauseAddressed: z
          .string()
          .describe("Which specific root cause this diagnostic targets"),
        expectedImpact: z
          .enum(["high", "moderate"])
          .describe("Expected value for root cause investigation based on mechanism"),
        implementationPriority: z
          .enum(["immediate", "important"])
          .describe(
            "Immediate: most critical for understanding root cause. Important: strong supporting value."
          ),
        whereToGet: z
          .string()
          .describe("Provider or lab source from the 'Where to get' column in CSV database (empty string if not available)"),
      })
    )
    .max(7)
    .min(1)
    .describe(
      "Maximum 7 highest-impact diagnostics. Select for clear root cause investigation value, not comprehensiveness."
    ),
});

export type RecommendDiagnosticsInput = z.infer<typeof recommendDiagnosticsInputSchema>;
export type RecommendDiagnosticsOutput = z.infer<typeof recommendDiagnosticsOutputSchema>;

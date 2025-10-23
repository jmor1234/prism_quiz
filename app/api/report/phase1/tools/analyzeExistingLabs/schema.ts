// app/api/report/phase1/tools/analyzeExistingLabs/schema.ts

import { z } from "zod";

// Input schema: what the primary agent passes to the tool
export const analyzeExistingLabsInputSchema = z.object({
  clientProfile: z.object({
    age: z.number().optional().describe("Client age"),
    gender: z.string().optional().describe("Client gender"),
    primarySymptoms: z
      .array(z.string())
      .describe("Key symptoms and concerns from assessment"),
  }).describe("Client demographic and clinical context"),

  analysisObjective: z
    .string()
    .optional()
    .describe("Guidance on what to focus on in the lab analysis"),
});

// Output schema: wrapper object containing analysis results
export const analyzeExistingLabsOutputSchema = z.object({
  analysis: z.object({
    findings: z
      .array(
        z.object({
          test: z.string().describe("Test name from lab results"),
          result: z.string().describe("Value with units and reference range if available"),
          assessment: z
            .string()
            .optional()
            .describe("Evaluation against Prism's optimal ranges or reference ranges"),
          implication: z
            .string()
            .describe("Clinical significance based on bioenergetic principles"),
        })
      )
      .describe("Individual lab result findings"),
    synthesis: z
      .string()
      .optional()
      .describe("Brief narrative connecting patterns across multiple findings"),
  }),
});

export type AnalyzeExistingLabsInput = z.infer<typeof analyzeExistingLabsInputSchema>;
type AnalyzeExistingLabsOutputWrapper = z.infer<typeof analyzeExistingLabsOutputSchema>;
export type AnalyzeExistingLabsOutput = AnalyzeExistingLabsOutputWrapper["analysis"];

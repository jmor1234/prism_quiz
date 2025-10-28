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
          test: z.string().describe("Test name"),
          clientResult: z.string().describe("Client's result value with units"),
          prismRange: z
            .string()
            .optional()
            .describe("Prism's optimal range from database if available"),
          interpretation: z
            .string()
            .describe("Concise clinical interpretation (2-3 sentences max) connecting this result to the client's symptoms through bioenergetic principles"),
        })
      )
      .describe("Individual lab result findings"),
    synthesis: z
      .string()
      .describe("Brief overview (1-2 sentences) connecting the most significant patterns across findings"),
  }),
});

export type AnalyzeExistingLabsInput = z.infer<typeof analyzeExistingLabsInputSchema>;
type AnalyzeExistingLabsOutputWrapper = z.infer<typeof analyzeExistingLabsOutputSchema>;
export type AnalyzeExistingLabsOutput = AnalyzeExistingLabsOutputWrapper["analysis"];

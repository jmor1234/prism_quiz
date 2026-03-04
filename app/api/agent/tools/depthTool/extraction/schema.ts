// app/api/agent/tools/depthTool/extraction/schema.ts

import { z } from "zod";

export const extractionSchema = z.object({
  findings: z
    .array(
      z.object({
        insight: z
          .string()
          .describe("Key finding relevant to the objective."),
        evidence: z
          .string()
          .describe("Direct quote or specific detail from the source."),
      })
    )
    .describe("Targeted findings from the source."),
  summary: z
    .string()
    .describe("Brief overall assessment of what this source contributes."),
});

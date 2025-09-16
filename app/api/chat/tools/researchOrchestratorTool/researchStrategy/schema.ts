import { z } from "zod";
import { EXA_CATEGORIES } from "../constants";

const exaCategoryEnum = z.enum(EXA_CATEGORIES);

export const researchPlannerSchema = z.object({
  focusedObjective: z
    .string()
    .describe(
      "Clear, focused statement of the specific research objective for this iteration"
    ),
  focusAreas: z
    .array(z.string())
    .describe(
      "Specific aspects or questions to investigate for this focused objective"
    ),
  recommendedCategories: z
    .array(exaCategoryEnum)
    .describe(
      "Exa content categories most relevant to this research objective"
    ),
  rationale: z
    .string()
    .describe(
      "Explanation of why this specific objective and approach will advance the overall research"
    ),
  keyEntities: z
    .array(z.string())
    .describe(
      "Important entities, concepts, or terms central to this research objective"
    ),
  timeContext: z
    .object({
      startDate: z
        .string()
        .optional()
        .describe("Start date for content in YYYY-MM-DD format"),
      endDate: z
        .string()
        .optional()
        .describe("End date for content in YYYY-MM-DD format"),
      recencyRequired: z
        .enum(["high", "medium", "low"])
        .default("medium")
        .describe("How important recent information is to this research"),
    })
    .optional(),
});

export type ResearchPlan = z.infer<typeof researchPlannerSchema>;



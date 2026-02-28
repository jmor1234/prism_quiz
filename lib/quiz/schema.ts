// lib/quiz/schema.ts

import { z } from "zod";
import type { QuestionConfig, VariantConfig } from "./types";

function questionToZodField(q: QuestionConfig): z.ZodTypeAny {
  switch (q.type) {
    case "slider":
      return z.number().min(q.min).max(q.max);

    case "yes_no":
      if (q.conditionalFollowUp) {
        const validValues = q.conditionalFollowUp.options.map((o) => o.value);
        return z.object({
          answer: z.boolean(),
          followUp: z
            .array(z.enum(validValues as [string, ...string[]]))
            .optional(),
        });
      }
      return z.boolean();

    case "multi_select": {
      const validValues = q.options.map((o) => o.value);
      return z.array(z.enum(validValues as [string, ...string[]]));
    }

    case "single_select": {
      const validValues = q.options.map((o) => o.value);
      return z.enum(validValues as [string, ...string[]]);
    }

    case "free_text":
      return q.required !== false ? z.string().min(1) : z.string();
  }
}

export function buildSubmissionSchema(variant: VariantConfig) {
  const answerFields: Record<string, z.ZodTypeAny> = {};
  for (const q of variant.questions) {
    answerFields[q.id] = questionToZodField(q);
  }

  return z.object({
    variant: z.literal(variant.slug),
    name: z.string().min(1),
    answers: z.object(answerFields),
  });
}

export type VariantSubmission = z.infer<ReturnType<typeof buildSubmissionSchema>>;

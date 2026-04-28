// lib/quiz/schema.ts

import { z } from "zod";
import type { QuestionConfig, VariantConfig } from "./types";
import { OTHER_PREFIX } from "./otherOption";

function questionToZodField(q: QuestionConfig): z.ZodTypeAny {
  switch (q.type) {
    case "slider":
      return z.number().min(q.min).max(q.max);

    case "yes_no": {
      const answerSchema = q.allowUnsure
        ? z.union([z.boolean(), z.literal("unsure")])
        : z.boolean();
      if (q.conditionalFollowUp) {
        const validValues = q.conditionalFollowUp.options.map((o) => o.value);
        return z.object({
          answer: answerSchema,
          followUp: z
            .array(z.enum(validValues as [string, ...string[]]))
            .optional(),
        });
      }
      return answerSchema;
    }

    case "multi_select": {
      const validValues = q.options.map((o) => o.value);
      const itemSchema = q.allowOther !== false
        ? z.union([
            z.enum(validValues as [string, ...string[]]),
            z.string().startsWith(OTHER_PREFIX).min(OTHER_PREFIX.length + 1).max(OTHER_PREFIX.length + 500),
          ])
        : z.enum(validValues as [string, ...string[]]);
      return z.array(itemSchema);
    }

    case "single_select": {
      const validValues = q.options.map((o) => o.value);
      const enumSchema = z.enum(validValues as [string, ...string[]]);
      if (q.allowOther !== false) {
        return z.union([
          enumSchema,
          z.string().startsWith(OTHER_PREFIX).min(OTHER_PREFIX.length + 1).max(OTHER_PREFIX.length + 500),
        ]);
      }
      return enumSchema;
    }

    case "free_text":
      return q.required !== false ? z.string().min(1) : z.string();

    case "yes_no_with_text":
      return z.object({
        answer: q.allowUnsure
          ? z.union([z.boolean(), z.literal("unsure")])
          : z.boolean(),
        text: z.string().max(2000),
      });
  }
}

export function buildSubmissionSchema(variant: VariantConfig) {
  const answerFields: Record<string, z.ZodTypeAny> = {};
  for (const q of variant.questions) {
    answerFields[q.id] = questionToZodField(q);
  }

  return z.object({
    variant: z.literal(variant.slug),
    name: z.string().optional().default(""),
    answers: z.object(answerFields),
  });
}

export type VariantSubmission = z.infer<ReturnType<typeof buildSubmissionSchema>>;

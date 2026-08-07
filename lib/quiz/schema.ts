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

const SOURCE_MAX_LENGTH = 64;

/**
 * Normalize partner attribution to a safe, comparable token.
 *
 * Deliberately total: every input maps to a string or to undefined, and
 * nothing rejects. `buildSubmissionSchema` returns one flat object, so a
 * field that *can* fail would discard a completed 38-answer intake over a
 * tracking value — the same class of bug the variant-normalization comment in
 * app/api/quiz/route.ts records having already shipped once. Attribution
 * annotates a submission; it must never be able to destroy one.
 *
 * Stripping to [a-z0-9_-] server-side also makes the value safe by
 * construction wherever it is later rendered (admin UI, PDF templates),
 * rather than relying on the client's normalization or on escaping downstream.
 */
function normalizeSource(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, SOURCE_MAX_LENGTH);
  return cleaned || undefined;
}

export function buildSubmissionSchema(variant: VariantConfig) {
  const answerFields: Record<string, z.ZodTypeAny> = {};
  for (const q of variant.questions) {
    answerFields[q.id] = questionToZodField(q);
  }

  // When a variant opts into intake, name + email are required at the server
  // boundary too — not just the client form. Otherwise both fields default to
  // empty strings (legacy behavior). Keeping a single schema shape lets the
  // API route access `parsed.data.email` without type-level branching.
  // Max-length caps are defensive: the body itself is already bounded by
  // Next.js, but storing a megabyte-long "name" in Redis is a footgun.
  const nameSchema = variant.requireIntake
    ? z.string().min(1).max(200)
    : z.string().max(200).optional().default("");
  const emailSchema = variant.requireIntake
    ? z.string().email().max(254)
    : z.string().max(254).optional().default("");

  return z.object({
    variant: z.literal(variant.slug),
    name: nameSchema,
    email: emailSchema,
    source: z.unknown().optional().transform(normalizeSource),
    answers: z.object(answerFields),
  });
}

export type VariantSubmission = z.infer<ReturnType<typeof buildSubmissionSchema>>;

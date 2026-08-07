// lib/quiz/variants/index.ts

import type { VariantConfig } from "../types";
import { rootCauseConfig } from "./root-cause";
import { gutConfig } from "./gut";
import { fatigueConfig } from "./fatigue";
import { hormonesWomenConfig } from "./hormones-women";
import { testosteroneConfig } from "./testosterone";
import { sleepConfig } from "./sleep";
import { thyroidConfig } from "./thyroid";
import { brainFogConfig } from "./brain-fog";
import { weightConfig } from "./weight";
import { skinConfig } from "./skin";
import { anxietyConfig } from "./anxiety";
import { allergiesConfig } from "./allergies";
import { prismAssessmentConfig } from "./prism-assessment";

const variants: Record<string, VariantConfig> = {
  "root-cause": rootCauseConfig,
  "gut": gutConfig,
  "fatigue": fatigueConfig,
  "hormones-women": hormonesWomenConfig,
  "testosterone": testosteroneConfig,
  "sleep": sleepConfig,
  "thyroid": thyroidConfig,
  "brain-fog": brainFogConfig,
  "weight": weightConfig,
  "skin": skinConfig,
  "anxiety": anxietyConfig,
  "allergies": allergiesConfig,
  "prism-assessment": prismAssessmentConfig,
};

// Slug aliases — keeps records stored under an earlier slug resolvable after a
// rename. Stored `record.variant` for pre-rename submissions still carries the
// old string, and retries plus result-page lookups need it to resolve to the
// current config.
//
// Resolution is a SINGLE hop (see getVariant), so every entry must point
// directly at a canonical registry key, never at another alias. Chaining
// "best-life-care" -> "best-life-harbor" -> "prism-assessment" would silently
// return undefined for the oldest slug — and live records at that slug exist.
const SLUG_ALIASES: Record<string, string> = {
  "best-life-harbor": "prism-assessment",
  "best-life-care": "prism-assessment",
};

export function getVariant(slug: string): VariantConfig | undefined {
  return variants[slug] ?? variants[SLUG_ALIASES[slug] ?? ""];
}

/**
 * True when `slug` names the Prism assessment pillar under any of its past or
 * present slugs. The pillar has its own isolated storage namespace, so this
 * decides which keyspace a submission reads and writes.
 *
 * Derived from the registry rather than kept as a hardcoded slug list: a list
 * has to be updated in lockstep at every rename, and a miss fails silently by
 * routing partner data into the shared quiz-* keyspace where the standard
 * admin filters it out — the lead would look like it vanished.
 */
export function isPrismAssessmentSlug(slug: string): boolean {
  return getVariant(slug)?.slug === prismAssessmentConfig.slug;
}

export function getAllVariants(): VariantConfig[] {
  return Object.values(variants);
}

export function getAllVariantSlugs(): string[] {
  return Object.keys(variants);
}

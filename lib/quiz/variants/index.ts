// lib/quiz/variants/index.ts

import type { VariantConfig } from "../types";
import { SLUG_ALIASES } from "../slugAliases";
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

// Slug aliases keep records stored under an earlier slug resolvable after a
// rename: stored `record.variant` is never rewritten, so retries and
// result-page lookups need the old string to resolve to the current config.
// The table lives in ./slugAliases so the client-side storage module can share
// it without importing every variant config.

/**
 * Resolve a slug — current or historical — to its config.
 *
 * Lookups are own-property guarded. A bare `variants[slug]` returns a truthy
 * non-config for keys inherited from Object.prototype ("__proto__",
 * "constructor"), which then passes an `if (!config)` guard at the call site
 * and fails much later with a confusing error.
 */
export function getVariant(slug: string): VariantConfig | undefined {
  if (Object.hasOwn(variants, slug)) return variants[slug];

  const aliased = Object.hasOwn(SLUG_ALIASES, slug)
    ? SLUG_ALIASES[slug]
    : undefined;
  if (aliased && Object.hasOwn(variants, aliased)) return variants[aliased];

  return undefined;
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

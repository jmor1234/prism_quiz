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
import { bestLifeHarborConfig } from "./best-life-harbor";

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
  "best-life-harbor": bestLifeHarborConfig,
};

// Legacy slug aliases — keeps old stored records resolvable after a rename.
// Stored `record.variant` for pre-rename submissions still says "best-life-care";
// retries and result-page lookups need that string to resolve to the new config.
const LEGACY_SLUG_ALIASES: Record<string, string> = {
  "best-life-care": "best-life-harbor",
};

export function getVariant(slug: string): VariantConfig | undefined {
  return variants[slug] ?? variants[LEGACY_SLUG_ALIASES[slug] ?? ""];
}

export function getAllVariants(): VariantConfig[] {
  return Object.values(variants);
}

export function getAllVariantSlugs(): string[] {
  return Object.keys(variants);
}

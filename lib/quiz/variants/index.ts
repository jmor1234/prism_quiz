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
import { bestLifeCareConfig } from "./best-life-care";

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
  "best-life-care": bestLifeCareConfig,
};

export function getVariant(slug: string): VariantConfig | undefined {
  return variants[slug];
}

export function getAllVariants(): VariantConfig[] {
  return Object.values(variants);
}

export function getAllVariantSlugs(): string[] {
  return Object.keys(variants);
}

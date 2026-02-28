// lib/quiz/variants/index.ts

import type { VariantConfig } from "../types";
import { rootCauseConfig } from "./root-cause";

const variants: Record<string, VariantConfig> = {
  "root-cause": rootCauseConfig,
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

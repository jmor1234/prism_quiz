// lib/quiz/slugAliases.ts
//
// The slug rename history, in one place.
//
// Deliberately a leaf module with no imports. lib/quizStorage.ts runs in the
// browser and needs this table to adopt client state saved under an earlier
// slug; importing the variant registry there would pull all 13 variant configs
// into the bundle. Keeping the table here lets both sides share one definition
// without that cost.

// Maps an earlier slug to the canonical registry key it now resolves to.
//
// Resolution is a SINGLE hop (see getVariant), so every entry must point
// directly at a canonical key, never at another alias. Chaining
// "best-life-care" -> "best-life-harbor" -> "prism-assessment" would silently
// return undefined for the oldest slug, and live records at that slug exist.
export const SLUG_ALIASES: Record<string, string> = {
  "best-life-harbor": "prism-assessment",
  "best-life-care": "prism-assessment",
};

/**
 * Slugs the given variant was previously known by, derived from the alias
 * table rather than restated. A rename then only has to touch SLUG_ALIASES.
 */
export function getPriorSlugs(canonicalSlug: string): string[] {
  return Object.entries(SLUG_ALIASES)
    .filter(([, target]) => target === canonicalSlug)
    .map(([prior]) => prior);
}

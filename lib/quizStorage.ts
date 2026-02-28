// lib/quizStorage.ts
// localStorage persistence for quiz state, scoped per variant

const STORAGE_KEY_PREFIX = "prism-quiz";
const LEGACY_KEY = "prism-quiz"; // v1 key (pre-variant)
const SCHEMA_VERSION = 2;

export type QuizStorageData = {
  v: typeof SCHEMA_VERSION;
  id: string;
  report: string | null; // null = submission exists but generation failed
};

// Cached values per variant
const cache = new Map<string, QuizStorageData | null>();

function storageKey(variant: string): string {
  return `${STORAGE_KEY_PREFIX}:${variant}`;
}

/**
 * Migrate v1 (pre-variant) storage to v2 variant-scoped key.
 * Only applicable for root-cause since that was the only variant in v1.
 */
function migrateV1(variant: string): QuizStorageData | null {
  if (typeof window === "undefined" || variant !== "root-cause") return null;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.v !== 1) return null;

    // Migrate: write to v2 key, delete v1 key
    const migrated: QuizStorageData = {
      v: SCHEMA_VERSION,
      id: parsed.id,
      report: parsed.report ?? null,
    };
    localStorage.setItem(storageKey(variant), JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch {
    return null;
  }
}

export function getQuizStorage(variant: string): QuizStorageData | null {
  if (typeof window === "undefined") return null;

  const cached = cache.get(variant);
  if (cached !== undefined) return cached;

  try {
    // Try v2 key first
    const raw = localStorage.getItem(storageKey(variant));
    if (raw) {
      const parsed = JSON.parse(raw) as QuizStorageData;
      if (parsed.v === SCHEMA_VERSION) {
        cache.set(variant, parsed);
        return parsed;
      }
      // Wrong version — clear it
      localStorage.removeItem(storageKey(variant));
    }

    // Try v1 migration for root-cause
    const migrated = migrateV1(variant);
    if (migrated) {
      cache.set(variant, migrated);
      return migrated;
    }

    cache.set(variant, null);
    return null;
  } catch {
    cache.set(variant, null);
    return null;
  }
}

export function setQuizStorage(
  variant: string,
  data: Omit<QuizStorageData, "v">
): void {
  if (typeof window === "undefined") return;

  const toStore: QuizStorageData = { v: SCHEMA_VERSION, ...data };
  localStorage.setItem(storageKey(variant), JSON.stringify(toStore));
  cache.set(variant, toStore);
}

export function clearQuizStorage(variant: string): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(storageKey(variant));
  cache.set(variant, null);
}

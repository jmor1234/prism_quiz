// lib/quizStorage.ts
// localStorage persistence for quiz state, scoped per variant

import { getPriorSlugs } from "./quiz/slugAliases";

const STORAGE_KEY_PREFIX = "prism-quiz";
const LEGACY_KEY = "prism-quiz"; // v1 key (pre-variant)
const SCHEMA_VERSION = 3;

export type QuizIntake = { name: string; email: string };

export type QuizStorageData = {
  v: typeof SCHEMA_VERSION;
  id: string;
  report: string | null; // null = submission exists but generation failed
  intake?: QuizIntake;   // present only for variants that gate on intake
};

// Cached values per variant
const cache = new Map<string, QuizStorageData | null>();

function storageKey(variant: string): string {
  return `${STORAGE_KEY_PREFIX}:${variant}`;
}

/**
 * Migrate v1 (pre-variant) storage to current v3 schema.
 * Only applicable for root-cause since that was the only variant in v1.
 */
function migrateV1(variant: string): QuizStorageData | null {
  if (typeof window === "undefined" || variant !== "root-cause") return null;

  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.v !== 1) return null;

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

// Accept v2 reads as-is: id + report are still valid; intake is simply absent
// for older entries. Writes always emit v3, so v2 entries upgrade silently on
// the next setQuizStorage call.
function upgradeFromV2(parsed: { v: number; id: string; report: string | null }):
  | QuizStorageData
  | null {
  if (parsed.v !== 2) return null;
  return { v: SCHEMA_VERSION, id: parsed.id, report: parsed.report ?? null };
}

/**
 * Parse a stored entry at any accepted schema version. Returns null for
 * unparseable or unknown-version data, which callers treat as "discard".
 * Shared by the normal read and the prior-slug migration so the two can't
 * drift apart on version handling.
 */
function parseStored(raw: string): QuizStorageData | null {
  try {
    const parsed = JSON.parse(raw) as QuizStorageData & { v: number };
    if (parsed.v === SCHEMA_VERSION) return parsed;
    return upgradeFromV2(
      parsed as { v: number; id: string; report: string | null }
    );
  } catch {
    return null;
  }
}

/**
 * Adopt client state saved under a slug this variant used to have.
 *
 * A slug rename otherwise orphans in-flight state, because the key is
 * `prism-quiz:{slug}`. Losing saved progress is the mild case; the real one is
 * a user whose generation failed, whose entry has `report: null` and whose
 * stored id is the only path back to their report — the wizard restores it as
 * `pendingSubmissionId` to offer a retry. Orphan that and the submission still
 * sits in Redis but the user can never reach it.
 */
function migrateFromPriorSlug(variant: string): QuizStorageData | null {
  if (typeof window === "undefined") return null;

  for (const priorSlug of getPriorSlugs(variant)) {
    const priorKey = storageKey(priorSlug);
    const raw = localStorage.getItem(priorKey);
    if (!raw) continue;

    // Consume the old key either way: adopted if usable, dropped if not.
    const parsed = parseStored(raw);
    if (parsed) {
      localStorage.setItem(storageKey(variant), JSON.stringify(parsed));
    }
    localStorage.removeItem(priorKey);
    if (parsed) return parsed;
  }

  return null;
}

export function getQuizStorage(variant: string): QuizStorageData | null {
  if (typeof window === "undefined") return null;

  const cached = cache.get(variant);
  if (cached !== undefined) return cached;

  try {
    const raw = localStorage.getItem(storageKey(variant));
    if (raw) {
      const parsed = parseStored(raw);
      if (parsed) {
        cache.set(variant, parsed);
        return parsed;
      }
      // Unknown version — clear it
      localStorage.removeItem(storageKey(variant));
    }

    const migrated = migrateFromPriorSlug(variant) ?? migrateV1(variant);
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

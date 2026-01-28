// lib/quizStorage.ts
// localStorage persistence for quiz state (per client-localstorage-schema pattern)

const STORAGE_KEY = "prism-quiz";
const SCHEMA_VERSION = 1;

export type QuizStorageData = {
  v: typeof SCHEMA_VERSION;
  id: string;
  report: string | null; // null = submission exists but generation failed
};

// Cached value to avoid repeated localStorage reads (per client-cache-storage pattern)
let cached: QuizStorageData | null | undefined = undefined;

export function getQuizStorage(): QuizStorageData | null {
  if (typeof window === "undefined") return null;

  if (cached !== undefined) return cached;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = null;
      return null;
    }

    const parsed = JSON.parse(raw) as QuizStorageData;

    // Version check - clear if outdated
    if (parsed.v !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      cached = null;
      return null;
    }

    cached = parsed;
    return parsed;
  } catch {
    cached = null;
    return null;
  }
}

export function setQuizStorage(data: Omit<QuizStorageData, "v">): void {
  if (typeof window === "undefined") return;

  const toStore: QuizStorageData = { v: SCHEMA_VERSION, ...data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  cached = toStore;
}

export function clearQuizStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
  cached = null;
}

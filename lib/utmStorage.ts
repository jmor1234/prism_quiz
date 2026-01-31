// lib/utmStorage.ts
// UTM/click ID capture with first-touch semantics
// Pattern mirrors quizStorage.ts (versioned schema, module cache, try-catch)

const STORAGE_KEY = "prism-utm";
const SCHEMA_VERSION = 1;

// Params to capture: click IDs + UTM family
const TRACKED_PARAMS = [
  "fbclid",
  "gclid",
  "msclkid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type TrackedParam = (typeof TRACKED_PARAMS)[number];

type UTMStorageData = {
  v: typeof SCHEMA_VERSION;
  params: Partial<Record<TrackedParam, string>>;
  capturedAt: number;
};

// Module-level cache (per js-cache-storage pattern)
let cached: UTMStorageData | null | undefined = undefined;

// Module-level guard: ensures capture runs exactly once per page load (per advanced-init-once pattern)
let captureExecuted = false;

/**
 * Read UTM data from localStorage with caching.
 */
function getUTMStorage(): UTMStorageData | null {
  if (typeof window === "undefined") return null;

  if (cached !== undefined) return cached;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = null;
      return null;
    }

    const parsed = JSON.parse(raw) as UTMStorageData;

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

/**
 * Capture UTM params from current URL.
 * Call once on page mount (in hydration effect).
 * First-touch semantics: only captures if nothing stored yet.
 */
export function captureUTMParams(): void {
  if (typeof window === "undefined") return;
  if (captureExecuted) return; // StrictMode double-call guard
  captureExecuted = true;

  // First-touch: don't overwrite existing
  const existing = getUTMStorage();
  if (existing !== null) return;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const params: Partial<Record<TrackedParam, string>> = {};

    for (const key of TRACKED_PARAMS) {
      const value = searchParams.get(key);
      if (value) {
        params[key] = value;
      }
    }

    // Only store if we captured something
    if (Object.keys(params).length > 0) {
      const toStore: UTMStorageData = {
        v: SCHEMA_VERSION,
        params,
        capturedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
      cached = toStore;
    }
  } catch {
    // localStorage unavailable - fail silently
  }
}

/**
 * Build booking URL with stored UTM params appended.
 * Call in click handler (per rerender-move-effect-to-event pattern).
 * Returns base URL unchanged if no params stored.
 */
export function buildBookingUrl(baseUrl: string): string {
  const stored = getUTMStorage();
  if (!stored || Object.keys(stored.params).length === 0) {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(stored.params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
}

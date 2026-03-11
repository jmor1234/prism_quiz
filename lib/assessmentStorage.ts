// lib/assessmentStorage.ts
// localStorage persistence for assessment intake state

import type { IntakeStep } from "@/app/api/assessment/types";

const STORAGE_KEY = "prism-assessment";
const SCHEMA_VERSION = 1;

export type QuestionHistoryEntry = {
  question: string;
  options: { value: string; label: string }[];
  freeTextPlaceholder: string;
  status: "in_progress" | "optional";
  progressEstimate: number;
  multiSelect: boolean;
};

export type AssessmentStorageData = {
  v: typeof SCHEMA_VERSION;
  name: string;
  steps: IntakeStep[];
  questionHistory: QuestionHistoryEntry[];
  resultId?: string;
  result?: { id: string; report: string };
};

let cache: AssessmentStorageData | null | undefined = undefined;

export function getAssessmentStorage(): AssessmentStorageData | null {
  if (typeof window === "undefined") return null;

  if (cache !== undefined) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AssessmentStorageData;
      if (parsed.v === SCHEMA_VERSION) {
        cache = parsed;
        return parsed;
      }
      localStorage.removeItem(STORAGE_KEY);
    }

    cache = null;
    return null;
  } catch {
    cache = null;
    return null;
  }
}

export function setAssessmentStorage(
  data: Omit<AssessmentStorageData, "v">
): void {
  if (typeof window === "undefined") return;

  const toStore: AssessmentStorageData = { v: SCHEMA_VERSION, ...data };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // QuotaExceededError — storage full, continue without persistence
  }
  cache = toStore;
}

export function clearAssessmentStorage(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
  cache = null;
}

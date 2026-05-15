// lib/quiz/resultUrl.ts
//
// Centralizes the shape of the public best-life-harbor result URL so the
// new viewer route, the copy-link button, and any future surfaces all
// agree on the path.

const BEST_LIFE_RESULT_PATH = "/quiz/best-life-harbor/result";

export function getBestLifeResultPath(quizId: string): string {
  return `${BEST_LIFE_RESULT_PATH}/${quizId}`;
}

export function getBestLifeResultUrl(quizId: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${getBestLifeResultPath(quizId)}`;
}

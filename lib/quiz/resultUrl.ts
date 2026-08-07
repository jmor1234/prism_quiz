// lib/quiz/resultUrl.ts
//
// Centralizes the shape of the public prism-assessment result URL so the
// viewer route, the copy-link button, and any future surfaces all agree on
// the path.
//
// Old links of the form /quiz/best-life-harbor/result/{id} were handed out
// before the rename; next.config.ts redirects them here.

const RESULT_PATH = "/quiz/prism-assessment/result";

export function getPrismAssessmentResultPath(quizId: string): string {
  return `${RESULT_PATH}/${quizId}`;
}

export function getPrismAssessmentResultUrl(
  quizId: string,
  origin?: string
): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${getPrismAssessmentResultPath(quizId)}`;
}

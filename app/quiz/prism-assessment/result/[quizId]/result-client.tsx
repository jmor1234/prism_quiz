"use client";

import dynamic from "next/dynamic";
import { prismAssessmentConfig } from "@/lib/quiz/variants/prism-assessment";

// Skip SSR for QuizResult entirely. Inside the wizard, QuizResult only ever
// renders after a client-side state transition (no SSR pass), so framer-motion
// runs cleanly. The new public route does SSR by default, and the framer-motion
// `useReducedMotion` hook returns null on the server but the real boolean on
// the client — that diff was firing a hydration warning on every visit.
const QuizResult = dynamic(
  () =>
    import("@/components/quiz/quiz-result").then((m) => ({
      default: m.QuizResult,
    })),
  { ssr: false }
);

export function PrismAssessmentResultClient({
  quizId,
  report,
}: {
  quizId: string;
  report: string;
}) {
  return (
    <QuizResult
      result={{ id: quizId, report }}
      variant={prismAssessmentConfig}
    />
  );
}

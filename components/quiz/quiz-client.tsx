"use client";

import { QuizWizard } from "./quiz-wizard";
import type { VariantConfig } from "@/lib/quiz/types";

export function QuizClient({ variant }: { variant: VariantConfig }) {
  return <QuizWizard config={variant} />;
}

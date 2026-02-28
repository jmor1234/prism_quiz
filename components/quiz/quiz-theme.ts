// components/quiz/quiz-theme.ts
// Shared styling constants for the quiz UI

export const ACCENT = {
  base: "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)] border-[var(--quiz-gold)]",
  light:
    "bg-[var(--quiz-gold)]/80 hover:bg-[var(--quiz-gold)] border-[var(--quiz-gold)]/80",
  text: "text-[var(--quiz-text-on-gold)]",
  ring: "ring-[var(--quiz-gold)]/20",
};

export const questionClass =
  "text-xl sm:text-2xl font-semibold text-center leading-relaxed quiz-question";

export const hintClass = "text-muted-foreground text-center text-sm";

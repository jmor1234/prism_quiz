"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";

export function AssessmentTransition({
  message,
  onContinue,
  onSkip,
}: {
  message: string;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : undefined;

  return (
    <div className="space-y-8 text-center">
      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition}
        className="flex justify-center"
      >
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center",
            "border-2 border-[var(--quiz-gold)] bg-[var(--quiz-gold)]/10"
          )}
        >
          <Sparkles className="w-5 h-5 text-[var(--quiz-gold-dark)]" />
        </div>
      </motion.div>

      <motion.p
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: shouldReduceMotion ? 0 : 0.15 }}
        className="text-muted-foreground leading-relaxed text-base"
      >
        {message}
      </motion.p>

      <motion.div
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition, delay: shouldReduceMotion ? 0 : 0.25 }}
        className="space-y-3 pt-2"
      >
        <button
          type="button"
          onClick={onContinue}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full",
            "text-sm font-semibold",
            "transition-all duration-300 ease-out",
            "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
            ACCENT.base,
            ACCENT.text
          )}
        >
          Continue for a more specific assessment
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onSkip}
          className={cn(
            "w-full px-6 py-3 rounded-full",
            "text-sm font-medium",
            "border-2 border-[var(--quiz-gold)] text-[var(--quiz-gold-dark)]",
            "hover:bg-[var(--quiz-gold)]/10",
            "transition-all duration-300 ease-out"
          )}
        >
          Get my assessment now
        </button>
      </motion.div>
    </div>
  );
}

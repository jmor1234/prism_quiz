"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";

export function IntroScreen({ onStart }: { onStart: () => void }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center space-y-8 max-w-md"
    >
      <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
        Your Symptoms Tell a Deeper Story
      </h1>
      <p className="text-muted-foreground text-lg">
        Most health struggles aren&apos;t isolated problems. They connect
        through your body&apos;s deeper systems. Answer a few questions and
        we&apos;ll show you the patterns most approaches miss and how
        we&apos;ll be able to build a protocol to help.
      </p>

      <button
        type="button"
        onClick={onStart}
        className={cn(
          "px-8 py-3 rounded-full text-base font-semibold",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
          ACCENT.base,
          ACCENT.text
        )}
      >
        Get Started
      </button>
    </motion.div>
  );
}

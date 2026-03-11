"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";
import { Input } from "@/components/ui/input";

export function IntroScreen({
  name,
  onNameChange,
  onStart,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onStart: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const canStart = name.trim().length > 0;

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center space-y-8 max-w-md"
    >
      <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
        Get Your Personalized Health Assessment
      </h1>
      <p className="text-muted-foreground text-lg">
        Answer a few questions and our AI will analyze your health patterns
        through an evidence-based bioenergetic lens.
      </p>

      <div className="w-full space-y-3">
        <label
          htmlFor="assessment-name"
          className="text-sm font-medium text-muted-foreground"
        >
          What should we call you?
        </label>
        <Input
          id="assessment-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          className="text-center text-lg py-3"
          onKeyDown={(e) => {
            if (e.key === "Enter" && canStart) onStart();
          }}
        />
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={!canStart}
        className={cn(
          "px-8 py-3 rounded-full text-base font-semibold",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
          ACCENT.base,
          ACCENT.text
        )}
      >
        Start Assessment
      </button>
    </motion.div>
  );
}

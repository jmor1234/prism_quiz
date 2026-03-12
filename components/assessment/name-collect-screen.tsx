"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";
import { Input } from "@/components/ui/input";

export function NameCollectScreen({
  name,
  onNameChange,
  onGenerate,
}: {
  name: string;
  onNameChange: (name: string) => void;
  onGenerate: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();

  const anim = (delay: number) =>
    shouldReduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay },
        };

  return (
    <div className="flex flex-col items-center text-center space-y-8 max-w-md">
      <motion.div
        {...anim(0)}
        className="w-14 h-14 rounded-full bg-[var(--quiz-gold)]/10 flex items-center justify-center"
      >
        <CheckCircle2 aria-hidden="true" className="w-7 h-7 text-[var(--quiz-gold)]" />
      </motion.div>

      <motion.h1
        {...anim(0.15)}
        className="text-3xl sm:text-4xl font-bold leading-tight"
      >
        We&apos;re ready to build your assessment
      </motion.h1>

      <motion.p {...anim(0.25)} className="text-muted-foreground text-lg">
        We&apos;ll analyze your responses and create a personalized health
        assessment based on what you&apos;ve shared.
      </motion.p>

      <motion.div {...anim(0.35)} className="w-full space-y-3">
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
          placeholder="Your first name (optional)"
          autoComplete="given-name"
          className="text-center text-lg py-3"
          onKeyDown={(e) => {
            if (e.key === "Enter") onGenerate();
          }}
        />
      </motion.div>

      <motion.button
        {...anim(0.45)}
        type="button"
        onClick={onGenerate}
        className={cn(
          "px-8 py-3 rounded-full text-base font-semibold",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
          ACCENT.base,
          ACCENT.text
        )}
      >
        Generate My Assessment
      </motion.button>
    </div>
  );
}

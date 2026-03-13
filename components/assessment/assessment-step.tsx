"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ACCENT, hintClass } from "@/components/quiz/quiz-theme";
import { Textarea } from "@/components/ui/textarea";

export function AssessmentStep({
  question,
  hint,
  options,
  selectedOptions,
  freeText,
  freeTextPlaceholder,
  multiSelect = true,
  onToggleOption,
  onFreeTextChange,
}: {
  question: string;
  hint?: string;
  options: { value: string; label: string }[];
  selectedOptions: string[];
  freeText: string;
  freeTextPlaceholder: string;
  multiSelect?: boolean;
  onToggleOption: (value: string) => void;
  onFreeTextChange: (text: string) => void;
}) {
  const baseStyles = cn(
    "px-6 py-3 !rounded-full text-sm font-medium border-2 min-h-[48px]",
    "transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out",
    "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
  );
  const unselectedStyles = cn(
    "border-border bg-background shadow-sm",
    "hover:shadow-md hover:border-[var(--quiz-gold)]/50 hover:bg-[var(--quiz-cream)]/50",
    "dark:hover:bg-[var(--quiz-cream)] dark:hover:border-[var(--quiz-gold)]/60",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quiz-gold)] focus-visible:ring-offset-2"
  );
  const selectedStyles = cn(
    ACCENT.base,
    ACCENT.text,
    "shadow-lg shadow-[var(--quiz-gold)]/25",
    "hover:shadow-xl hover:shadow-[var(--quiz-gold)]/30"
  );

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg sm:text-xl font-semibold text-center leading-relaxed quiz-question">
          {question}
        </h2>
        {hint && <p className={hintClass}>{hint}</p>}
        {multiSelect && options.length > 0 && (
          <p className={hintClass}>Select all that apply</p>
        )}
      </div>

      {options.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {options.map((option) => {
            const isSelected = selectedOptions.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onToggleOption(option.value)}
                className={cn(
                  baseStyles,
                  isSelected ? selectedStyles : unselectedStyles
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <Textarea
        value={freeText}
        onChange={(e) => onFreeTextChange(e.target.value)}
        placeholder={freeTextPlaceholder}
        rows={3}
        className="text-base"
        aria-label={question}
      />
    </div>
  );
}

const LOADING_MESSAGES = [
  "Analyzing your responses\u2026",
  "Looking at how your symptoms connect\u2026",
  "Identifying the most relevant areas\u2026",
  "Personalizing your next question\u2026",
  "Fine-tuning the options for you\u2026",
  "Almost ready\u2026",
];

const PILL_WIDTHS = [110, 140, 120, 150];

const shimmerPulse = (delay: number) => ({
  animate: { opacity: [0.5, 0.85, 0.5] },
  transition: {
    duration: 1.8,
    repeat: Infinity,
    delay,
    ease: "easeInOut" as const,
  },
});

/**
 * Loading indicator shown while the next step is fetched from the API.
 * Content skeleton mirrors the real AssessmentStep layout so the
 * transition feels like a reveal rather than a replacement.
 */
export function AssessmentStepSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6 w-full max-w-md">
      {/* Pulsing dots */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--quiz-gold)]"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Progressive message */}
      <div className="h-5 relative">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground"
          >
            {LOADING_MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Content skeleton — mirrors AssessmentStep layout */}
      <div className="w-full space-y-8 mt-2">
        {/* Question line */}
        <div className="flex justify-center">
          <motion.div
            className="h-5 w-[70%] rounded-full bg-foreground/15 dark:bg-muted"
            {...shimmerPulse(0)}
          />
        </div>

        {/* Option pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {PILL_WIDTHS.map((w, i) => (
            <motion.div
              key={i}
              className="h-11 rounded-full bg-foreground/10 border border-foreground/15 dark:bg-muted dark:border-border"
              style={{ width: w }}
              {...shimmerPulse(0.1 * (i + 1))}
            />
          ))}
        </div>

        {/* Textarea */}
        <motion.div
          className="h-20 w-full rounded-lg bg-foreground/10 border border-foreground/15 dark:bg-muted/80 dark:border-border"
          {...shimmerPulse(0.5)}
        />
      </div>
    </div>
  );
}

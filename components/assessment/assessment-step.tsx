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
  "Analyzing your answers...",
  "Personalizing your next question...",
  "Understanding your patterns...",
];

/**
 * Loading indicator shown while the next step is fetched from the API.
 */
export function AssessmentStepSkeleton() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
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
    </div>
  );
}

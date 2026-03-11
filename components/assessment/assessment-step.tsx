"use client";

import { cn } from "@/lib/utils";
import { ACCENT, questionClass, hintClass } from "@/components/quiz/quiz-theme";
import { Textarea } from "@/components/ui/textarea";

export function AssessmentStep({
  question,
  hint,
  options,
  selectedOptions,
  freeText,
  freeTextPlaceholder,
  onToggleOption,
  onFreeTextChange,
}: {
  question: string;
  hint?: string;
  options: { value: string; label: string }[];
  selectedOptions: string[];
  freeText: string;
  freeTextPlaceholder: string;
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
      <h2 className={questionClass}>{question}</h2>
      {hint && <p className={hintClass}>{hint}</p>}

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

/**
 * Skeleton placeholder shown while the next step is loading from the API.
 */
export function AssessmentStepSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 bg-muted rounded-lg w-3/4 mx-auto" />
      <div className="flex flex-wrap justify-center gap-3">
        {[100, 120, 90, 140, 110].map((w, i) => (
          <div
            key={i}
            className="h-12 bg-muted rounded-full"
            style={{ width: `${w}px` }}
          />
        ))}
      </div>
      <div className="h-20 bg-muted rounded-lg" />
    </div>
  );
}

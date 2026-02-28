"use client";

import { cn } from "@/lib/utils";
import { ACCENT, questionClass, hintClass } from "../quiz-theme";
import type { MultiSelectQuestionConfig, OptionConfig } from "@/lib/quiz/types";

export function MultiSelectQuestion({
  config,
  value,
  onChange,
}: {
  config: MultiSelectQuestionConfig;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((s) => s !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <OptionButtons
        options={config.options}
        selected={value}
        onToggle={toggle}
      />
    </div>
  );
}

function OptionButtons({
  options,
  selected,
  onToggle,
}: {
  options: OptionConfig[];
  selected: string[];
  onToggle: (value: string) => void;
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
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
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
  );
}

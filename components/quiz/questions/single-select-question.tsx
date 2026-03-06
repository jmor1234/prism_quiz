"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ACCENT, questionClass, hintClass } from "../quiz-theme";
import type { SingleSelectQuestionConfig } from "@/lib/quiz/types";
import {
  isOtherValue,
  getOtherText,
  buildOtherValue,
  OTHER_VALUE,
} from "@/lib/quiz/otherOption";

export function SingleSelectQuestion({
  config,
  value,
  onChange,
}: {
  config: SingleSelectQuestionConfig;
  value: string | null;
  onChange: (value: string) => void;
}) {
  const otherActive = value !== null && isOtherValue(value);
  const [otherText, setOtherText] = useState(() =>
    otherActive ? getOtherText(value) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when "Other" is first selected
  useEffect(() => {
    if (otherActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [otherActive]);

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
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {config.options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setOtherText("");
                onChange(option.value);
              }}
              className={cn(
                baseStyles,
                isSelected ? selectedStyles : unselectedStyles
              )}
            >
              {option.label}
            </button>
          );
        })}
        {config.allowOther !== false && (
          <button
            type="button"
            onClick={() => {
              if (!otherActive) onChange(OTHER_VALUE);
            }}
            className={cn(
              baseStyles,
              otherActive ? selectedStyles : unselectedStyles
            )}
          >
            Other (specify)
          </button>
        )}
      </div>
      {config.allowOther !== false && otherActive && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <input
            ref={inputRef}
            type="text"
            value={otherText}
            onChange={(e) => {
              setOtherText(e.target.value);
              onChange(buildOtherValue(e.target.value));
            }}
            placeholder="Please specify..."
            maxLength={500}
            className={cn(
              "w-full px-4 py-3 rounded-xl border-2 border-border bg-background text-sm",
              "focus:outline-none focus:ring-2 focus:ring-[var(--quiz-gold)] focus:border-[var(--quiz-gold)]",
              "placeholder:text-muted-foreground"
            )}
          />
        </div>
      )}
    </div>
  );
}

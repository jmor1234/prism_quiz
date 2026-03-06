"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ACCENT, questionClass, hintClass } from "../quiz-theme";
import type { MultiSelectQuestionConfig, OptionConfig } from "@/lib/quiz/types";
import {
  isOtherValue,
  getOtherText,
  buildOtherValue,
  OTHER_VALUE,
} from "@/lib/quiz/otherOption";

export function MultiSelectQuestion({
  config,
  value,
  onChange,
}: {
  config: MultiSelectQuestionConfig;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const otherEntry = value.find(isOtherValue);
  const otherActive = otherEntry !== undefined;
  const [otherText, setOtherText] = useState(() =>
    otherEntry ? getOtherText(otherEntry) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [otherActive]);

  const toggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((s) => s !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const toggleOther = () => {
    if (otherActive) {
      onChange(value.filter((v) => !isOtherValue(v)));
      setOtherText("");
    } else {
      onChange([...value, OTHER_VALUE]);
    }
  };

  const handleOtherTextChange = (text: string) => {
    setOtherText(text);
    const newValue = buildOtherValue(text);
    onChange(value.map((v) => (isOtherValue(v) ? newValue : v)));
  };

  return (
    <div className="space-y-8">
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <OptionButtons
        options={config.options}
        selected={value}
        onToggle={toggle}
        allowOther={config.allowOther !== false}
        otherActive={otherActive}
        onToggleOther={toggleOther}
      />
      {config.allowOther !== false && otherActive && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <input
            ref={inputRef}
            type="text"
            value={otherText}
            onChange={(e) => handleOtherTextChange(e.target.value)}
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

function OptionButtons({
  options,
  selected,
  onToggle,
  allowOther,
  otherActive,
  onToggleOther,
}: {
  options: OptionConfig[];
  selected: string[];
  onToggle: (value: string) => void;
  allowOther?: boolean;
  otherActive?: boolean;
  onToggleOther?: () => void;
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
      {allowOther && onToggleOther && (
        <button
          type="button"
          onClick={onToggleOther}
          className={cn(
            baseStyles,
            otherActive ? selectedStyles : unselectedStyles
          )}
        >
          Other (specify)
        </button>
      )}
    </div>
  );
}

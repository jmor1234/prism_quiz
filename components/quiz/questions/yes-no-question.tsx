"use client";

import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCENT, questionClass, hintClass } from "../quiz-theme";
import type { YesNoQuestionConfig, YesNoWithFollowUp, OptionConfig } from "@/lib/quiz/types";

// --- YesNoToggle (reusable sub-component) ---

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  const baseStyles = cn(
    "px-12 h-14 text-base font-medium !rounded-full border-2",
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
    <div className="flex justify-center">
      <ToggleGroup
        type="single"
        value={value === null ? "" : value ? "yes" : "no"}
        onValueChange={(v) => v && onChange(v === "yes")}
        className="gap-4"
      >
        <ToggleGroupItem
          value="yes"
          className={cn(
            baseStyles,
            value === true ? selectedStyles : unselectedStyles
          )}
        >
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem
          value="no"
          className={cn(
            baseStyles,
            value === false ? selectedStyles : unselectedStyles
          )}
        >
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

// --- OptionMultiSelect (for conditional follow-up) ---

function OptionMultiSelect({
  options,
  selected,
  onChange,
}: {
  options: OptionConfig[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

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
            onClick={() => toggle(option.value)}
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

// --- Main YesNoQuestion component ---

export function YesNoQuestion({
  config,
  value,
  onChange,
}: {
  config: YesNoQuestionConfig;
  value: boolean | null | YesNoWithFollowUp;
  onChange: (value: boolean | null | YesNoWithFollowUp) => void;
}) {
  if (config.conditionalFollowUp) {
    const compound = value as YesNoWithFollowUp;
    const answer = compound?.answer ?? null;
    const followUp = compound?.followUp ?? [];

    return (
      <div className="space-y-8">
        <h2 className={questionClass}>{config.question}</h2>
        <YesNoToggle
          value={answer}
          onChange={(v) =>
            onChange({
              answer: v,
              followUp: v ? followUp : [],
            })
          }
        />
        {answer === true && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className={hintClass}>{config.conditionalFollowUp.prompt}</p>
            <OptionMultiSelect
              options={config.conditionalFollowUp.options}
              selected={followUp}
              onChange={(newFollowUp) =>
                onChange({ answer: true, followUp: newFollowUp })
              }
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h2 className={questionClass}>{config.question}</h2>
      <YesNoToggle
        value={value as boolean | null}
        onChange={(v) => onChange(v)}
      />
    </div>
  );
}

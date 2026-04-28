"use client";

import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCENT, questionClass, hintClass } from "../quiz-theme";
import type {
  YesNoWithTextQuestionConfig,
  YesNoWithText,
  YesNoAnswer,
} from "@/lib/quiz/types";

function answerToToggleValue(value: YesNoAnswer): string {
  if (value === null) return "";
  if (value === "unsure") return "unsure";
  return value ? "yes" : "no";
}

function toggleValueToAnswer(v: string): YesNoAnswer {
  if (v === "yes") return true;
  if (v === "no") return false;
  if (v === "unsure") return "unsure";
  return null;
}

function YesNoToggle({
  value,
  onChange,
  allowUnsure,
}: {
  value: YesNoAnswer;
  onChange: (v: YesNoAnswer) => void;
  allowUnsure?: boolean;
}) {
  const baseStyles = cn(
    "h-14 text-base font-medium !rounded-full border-2",
    "transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out",
    "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm"
  );
  const px = allowUnsure ? "px-8" : "px-12";
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
        value={answerToToggleValue(value)}
        onValueChange={(v) => {
          if (!v) return;
          onChange(toggleValueToAnswer(v));
        }}
        className="gap-3 sm:gap-4 flex-wrap justify-center"
      >
        <ToggleGroupItem
          value="yes"
          className={cn(baseStyles, px, value === true ? selectedStyles : unselectedStyles)}
        >
          Yes
        </ToggleGroupItem>
        {allowUnsure && (
          <ToggleGroupItem
            value="unsure"
            className={cn(baseStyles, px, value === "unsure" ? selectedStyles : unselectedStyles)}
          >
            Unsure
          </ToggleGroupItem>
        )}
        <ToggleGroupItem
          value="no"
          className={cn(baseStyles, px, value === false ? selectedStyles : unselectedStyles)}
        >
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export function YesNoWithTextQuestion({
  config,
  value,
  onChange,
}: {
  config: YesNoWithTextQuestionConfig;
  value: YesNoWithText;
  onChange: (value: YesNoWithText) => void;
}) {
  const answer = value?.answer ?? null;
  const text = value?.text ?? "";
  // Textarea is useful when the user picks Yes OR Unsure ("I think dairy
  // but I'm not sure"). Hidden only on No.
  const showTextarea = answer === true || answer === "unsure";

  return (
    <div className="space-y-8">
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <YesNoToggle
        value={answer}
        allowUnsure={config.allowUnsure}
        onChange={(v) => onChange({ answer: v, text })}
      />
      {showTextarea && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {config.textPrompt && <p className={hintClass}>{config.textPrompt}</p>}
          <Textarea
            value={text}
            onChange={(e) => onChange({ answer, text: e.target.value })}
            placeholder={config.placeholder ?? "Optional — add details if you'd like"}
            rows={config.rows ?? 3}
            className="text-base"
            aria-label={config.textPrompt ?? "Additional details"}
          />
        </div>
      )}
    </div>
  );
}

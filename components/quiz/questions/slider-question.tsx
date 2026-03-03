"use client";

import { Slider } from "@/components/ui/slider";
import { questionClass, hintClass } from "../quiz-theme";
import type { SliderQuestionConfig } from "@/lib/quiz/types";

export function SliderQuestion({
  config,
  value,
  onChange,
}: {
  config: SliderQuestionConfig;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-8">
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <div className="space-y-4">
        <div className="space-y-2">
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={config.min}
            max={config.max}
            step={1}
            aria-label={config.question}
          />
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              {config.lowLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              {config.highLabel}
            </span>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="relative inline-block">
            <span className="text-5xl font-bold tabular-nums text-foreground">
              {value}
            </span>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-[var(--quiz-gold)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

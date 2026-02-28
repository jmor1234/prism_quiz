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
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-16">
            {config.lowLabel}
          </span>
          <Slider
            value={[value]}
            onValueChange={([v]) => onChange(v)}
            min={config.min}
            max={config.max}
            step={1}
            className="flex-1"
            aria-label={config.question}
          />
          <span className="text-xs text-muted-foreground w-16 text-right">
            {config.highLabel}
          </span>
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

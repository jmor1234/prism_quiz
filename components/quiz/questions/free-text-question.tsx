"use client";

import { Textarea } from "@/components/ui/textarea";
import { questionClass, hintClass } from "../quiz-theme";
import type { FreeTextQuestionConfig } from "@/lib/quiz/types";

export function FreeTextQuestion({
  config,
  value,
  onChange,
}: {
  config: FreeTextQuestionConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className={questionClass}>{config.question}</h2>
      {config.hint && <p className={hintClass}>{config.hint}</p>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={config.placeholder}
        rows={config.rows ?? 4}
        className="text-base"
        aria-label={config.question}
      />
    </div>
  );
}

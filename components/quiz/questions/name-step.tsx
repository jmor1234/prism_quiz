"use client";

import { Input } from "@/components/ui/input";
import { questionClass, hintClass } from "../quiz-theme";
import type { VariantConfig } from "@/lib/quiz/types";

export function NameStep({
  config,
  value,
  onChange,
}: {
  config: VariantConfig["nameField"];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className={questionClass}>{config.question}</h2>
      <p className={hintClass}>{config.hint}</p>
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="quiz-name-input" className="block text-sm font-medium">
            Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="quiz-name-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={config.placeholder ?? "Your name"}
            className="h-12 text-base"
            autoComplete="name"
          />
        </div>
      </div>
    </div>
  );
}

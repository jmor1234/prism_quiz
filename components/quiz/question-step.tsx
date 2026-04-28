"use client";

import type { QuestionConfig, YesNoWithFollowUp, YesNoWithText } from "@/lib/quiz/types";
import { SliderQuestion } from "./questions/slider-question";
import { YesNoQuestion } from "./questions/yes-no-question";
import { MultiSelectQuestion } from "./questions/multi-select-question";
import { SingleSelectQuestion } from "./questions/single-select-question";
import { FreeTextQuestion } from "./questions/free-text-question";
import { YesNoWithTextQuestion } from "./questions/yes-no-with-text-question";

export function QuestionStep({
  config,
  value,
  onChange,
}: {
  config: QuestionConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (config.type) {
    case "slider":
      return (
        <SliderQuestion
          config={config}
          value={value as number}
          onChange={onChange}
        />
      );
    case "yes_no":
      return (
        <YesNoQuestion
          config={config}
          value={value as boolean | null | YesNoWithFollowUp}
          onChange={onChange}
        />
      );
    case "multi_select":
      return (
        <MultiSelectQuestion
          config={config}
          value={value as string[]}
          onChange={onChange}
        />
      );
    case "single_select":
      return (
        <SingleSelectQuestion
          config={config}
          value={value as string | null}
          onChange={onChange}
        />
      );
    case "free_text":
      return (
        <FreeTextQuestion
          config={config}
          value={value as string}
          onChange={onChange}
        />
      );
    case "yes_no_with_text":
      return (
        <YesNoWithTextQuestion
          config={config}
          value={value as YesNoWithText}
          onChange={onChange}
        />
      );
  }
}

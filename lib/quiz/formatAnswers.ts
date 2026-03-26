// lib/quiz/formatAnswers.ts

import type {
  QuestionConfig,
  VariantConfig,
  QuizAnswers,
  YesNoWithFollowUp,
} from "./types";
import { isOtherValue, getOtherText } from "./otherOption";

function getOptionPromptLabel(option: { label: string; promptLabel?: string }): string {
  return option.promptLabel ?? option.label.toLowerCase();
}

function formatSingleAnswer(q: QuestionConfig, value: unknown): string {
  const label = q.promptLabel ?? q.question;

  switch (q.type) {
    case "slider": {
      const num = value as number;
      let qualifier = "";
      if (q.qualifiers) {
        for (const qf of q.qualifiers) {
          if (num <= qf.max) {
            qualifier = ` (${qf.label})`;
            break;
          }
        }
      }
      return `**${label}:** ${num}/${q.max}${qualifier}`;
    }

    case "yes_no": {
      if (q.conditionalFollowUp) {
        const compound = value as YesNoWithFollowUp;
        if (compound.answer) {
          const followUp =
            compound.followUp && compound.followUp.length > 0
              ? compound.followUp
                  .map((v) => {
                    const opt = q.conditionalFollowUp!.options.find(
                      (o) => o.value === v
                    );
                    return opt ? getOptionPromptLabel(opt) : v;
                  })
                  .join(", ")
              : "reasons not specified";
          return `**${label}:** Yes (${followUp})`;
        }
        return `**${label}:** No`;
      }
      return `**${label}:** ${value ? "Yes" : "No"}`;
    }

    case "multi_select": {
      const selected = value as string[];
      if (selected.length > 0) {
        const labels = selected
          .map((v) => {
            if (isOtherValue(v)) return `other: ${getOtherText(v)}`;
            const opt = q.options.find((o) => o.value === v);
            return opt ? getOptionPromptLabel(opt) : v;
          })
          .join(", ");
        return `**${label}:** ${labels}`;
      }
      return `**${label}:** None reported`;
    }

    case "single_select": {
      const selected = value as string;
      if (isOtherValue(selected)) {
        return `**${label}:** other: ${getOtherText(selected)}`;
      }
      const opt = q.options.find((o) => o.value === selected);
      return `**${label}:** ${opt ? getOptionPromptLabel(opt) : selected}`;
    }

    case "free_text":
      return `**${label}:**\n${value}`;
  }
}

export function formatAnswers(
  variant: VariantConfig,
  name: string,
  answers: QuizAnswers
): string {
  const lines: string[] = [];

  if (name && name.trim()) {
    lines.push(`**Name:** ${name}`);
  }

  for (const q of variant.questions) {
    const value = answers[q.id];
    lines.push(formatSingleAnswer(q, value));
  }

  return lines.join("\n\n");
}

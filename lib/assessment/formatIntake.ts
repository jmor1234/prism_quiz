// lib/assessment/formatIntake.ts

import type { IntakeStep } from "@/app/api/assessment/types";

/**
 * Converts accumulated intake steps into a markdown string
 * for the assessment agent's user message.
 */
export function formatIntake(
  name: string | undefined,
  steps: IntakeStep[]
): string {
  const lines: string[] = [];

  if (name) {
    lines.push(`**Name:** ${name}`);
  }

  for (const step of steps) {
    lines.push(`**${step.question}**`);

    if (step.selectedOptions.length > 0) {
      lines.push(step.selectedOptions.join(", "));
    }

    if (step.freeText.trim()) {
      lines.push(step.freeText.trim());
    }
  }

  return lines.join("\n\n");
}

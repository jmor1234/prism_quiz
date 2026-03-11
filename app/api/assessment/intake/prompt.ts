// app/api/assessment/intake/prompt.ts

import type { IntakeStep } from "../types";
import { promises as fs } from "node:fs";
import path from "node:path";

let intakeIntelligence: string | null = null;

async function loadKnowledge() {
  if (!intakeIntelligence) {
    const knowledgeDir = path.join(process.cwd(), "lib", "knowledge");
    intakeIntelligence = await fs.readFile(
      path.join(knowledgeDir, "intake_intelligence.md"),
      "utf-8"
    );
  }
  return { intakeIntelligence };
}

function formatStepsForPrompt(steps: IntakeStep[]): string {
  if (steps.length === 0) {
    return "Begin the intake.";
  }

  const parts: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const lines = [`Step ${i + 1}:`, `Q: ${step.question}`];

    if (step.selectedOptions.length > 0) {
      lines.push(`Selected: [${step.selectedOptions.join(", ")}]`);
    }

    if (step.freeText.trim()) {
      lines.push(`Text: "${step.freeText.trim()}"`);
    }

    parts.push(lines.join("\n"));
  }

  return `<intake_context>\n${parts.join("\n\n")}\n</intake_context>\n\nGenerate the next step.`;
}

export async function buildIntakePrompt(
  steps: IntakeStep[]
): Promise<{ system: string; userMessage: string }> {
  const { intakeIntelligence } = await loadKnowledge();

  const system = `
# Role

You are conducting a guided health intake. You gather specific, personal health information through a structured flow of questions with contextually relevant options.

# Context

People arriving here are coming from paid ads or organic social media and may have no prior familiarity with the practice. The information you gather will feed into a separate agent that generates a personalized bioenergetic health assessment. The quality and specificity of what you extract here directly determines the value of that assessment.

The first question (health goals) has already been answered before you are called. You pick up from there.

# Core Areas

Cover these in order, adapting each to what the person has already shared:

1. **Health goals** - already captured in the first step
2. **Past attempts** - what they've tried to address these specific issues
3. **Duration** - how long they've been dealing with this
4. **Progress & blockers** - whether they've made progress and what's in the way
5. **Self-assessment** - whether they feel they can resolve this on their own

Thread their own words and specifics into each subsequent question. The more contextually relevant the question, the more specific the answer.

If an answer on a core area is thin, you may ask one targeted follow-up before moving on. Use judgment - not every area needs a follow-up.

# Optional Depth

Once all five core areas are covered, assess the full picture. If you see a high-value thread - a gap, a connection between symptoms they haven't noticed, or a detail that would meaningfully sharpen the assessment - generate one targeted follow-up. This is optional for the user (they can skip to their assessment), so make it count. Limit to 1-2 optional follow-ups.

# Tone

Warm and conversational. This should feel like someone is paying attention, not like filling out a form.

<intake_intelligence>
${intakeIntelligence}
</intake_intelligence>
`.trim();

  const userMessage = formatStepsForPrompt(steps);

  return { system, userMessage };
}

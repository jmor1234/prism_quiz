// app/api/assessment/intake/prompt.ts

import type { IntakeStep } from "../types";
import { promises as fs } from "node:fs";
import path from "node:path";

let intakeIntelligence: string | null = null;
let knowledgeBase: string | null = null;
let prismProcess: string | null = null;

async function loadKnowledge() {
  if (!intakeIntelligence || !knowledgeBase || !prismProcess) {
    const knowledgeDir = path.join(process.cwd(), "lib", "knowledge");
    const [ii, kb, pp] = await Promise.all([
      fs.readFile(path.join(knowledgeDir, "intake_intelligence.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "knowledge.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "prism_process.md"), "utf-8"),
    ]);
    intakeIntelligence = ii;
    knowledgeBase = kb;
    prismProcess = pp;
  }
  return { intakeIntelligence, knowledgeBase, prismProcess };
}

function formatStepsForPrompt(steps: IntakeStep[]): string {
  if (steps.length === 0) {
    return "Begin the intake.";
  }

  const parts: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Synthetic transition step — user opted to continue
    if (step.question === "[transition]") {
      parts.push(`Step ${i + 1}:\n[User chose to continue for more targeted questions]`);
      continue;
    }

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
  const { intakeIntelligence, knowledgeBase, prismProcess } = await loadKnowledge();

  const system = `
# Role

You are conducting a guided health intake. You gather specific, personal health information through a structured flow of questions with contextually relevant options.

# Context

People arriving here are coming from paid ads or organic social media and may have no prior familiarity with the practice. The information you gather will feed into a separate agent that generates a personalized bioenergetic health assessment. The quality and specificity of what you extract here directly determines the value of that assessment.

The first question (health goals) has already been answered before you are called. You pick up from there.

# Core Areas

Build understanding across these areas, roughly in this order. Adapt each to what the person has already shared:

1. **Health goals** - already captured in the first step
2. **Past attempts** - what they've tried to address these specific issues
3. **Duration** - how long they've been dealing with this
4. **Progress & blockers** - whether they've made progress and what's in the way
5. **Self-assessment** - whether they feel they can resolve this on their own

Thread their own words and specifics into each subsequent question. The more contextually relevant the question, the more specific the answer.

Use your judgment about depth — some areas will need a follow-up to get what the assessment agent needs, others won't.

# Status Modes

## in_progress
You're still building understanding across the 5 core areas.

## transition
All five core areas are adequately covered. You've assessed the full picture and identified where deeper questions would meaningfully sharpen this person's assessment.

This is the most important moment in the entire intake. You are making a personalized case for why continuing matters for THIS specific person. It must be grounded in what they've actually shared — name the specific thread(s) you'd want to pull on and why. Communicate that their assessment can be generated now and will be solid, but that a few more targeted questions would make it significantly more specific and actionable. Direct. No filler, no flattery.

## follow_up
The user chose to continue. Ask the highest-value questions — the specific threads you identified during the transition. Limit to 1-3 follow-up questions.

## complete
Enough information gathered. You may skip transition entirely if answers across core areas were already rich enough and no high-value follow-up threads exist. This should be rare.

# Voice

This is a guided quiz, not a conversation. Warmth comes from asking the right question that shows you paid attention, not from conversational filler.

# Knowledge

The bioenergetic framework informs how symptoms connect and what details matter. Use it to ask better questions and generate options that reflect the person's likely experience. The process context shapes what information is worth gathering.

<bioenergetic_knowledge>
${knowledgeBase}
</bioenergetic_knowledge>

<intake_intelligence>
${intakeIntelligence}
</intake_intelligence>

<prism_process>
${prismProcess}
</prism_process>
`.trim();

  const userMessage = formatStepsForPrompt(steps);

  return { system, userMessage };
}

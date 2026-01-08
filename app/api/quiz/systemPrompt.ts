// app/api/quiz/systemPrompt.ts

import type { QuizSubmission } from "@/lib/schemas/quiz";
import { promises as fs } from "node:fs";
import path from "node:path";

// Cache knowledge files after first load
let knowledgeBase: string | null = null;
let questionnaireGuide: string | null = null;
let dietLifestyleGuide: string | null = null;

async function loadKnowledge() {
  if (!knowledgeBase || !questionnaireGuide || !dietLifestyleGuide) {
    const knowledgeDir = path.join(process.cwd(), "lib", "knowledge");

    knowledgeBase = await fs.readFile(
      path.join(knowledgeDir, "knowledge.md"),
      "utf-8"
    );
    questionnaireGuide = await fs.readFile(
      path.join(knowledgeDir, "questionaire.md"),
      "utf-8"
    );
    dietLifestyleGuide = await fs.readFile(
      path.join(knowledgeDir, "diet_lifestyle_standardized.md"),
      "utf-8"
    );
  }
  return { knowledgeBase, questionnaireGuide, dietLifestyleGuide };
}

/**
 * Format quiz answers for the prompt
 */
function formatAnswers(submission: QuizSubmission): string {
  const lines: string[] = [];

  lines.push(
    `**Energy Level:** ${submission.energyLevel}/10${submission.energyLevel <= 4 ? " (low)" : submission.energyLevel <= 6 ? " (moderate)" : " (good)"}`
  );

  lines.push(
    `**Crash after lunch:** ${submission.crashAfterLunch ? "Yes" : "No"}`
  );

  lines.push(
    `**Difficulty waking in the morning:** ${submission.difficultyWaking ? "Yes" : "No"}`
  );

  if (submission.wakeAtNight.wakes) {
    const reasons =
      submission.wakeAtNight.reasons && submission.wakeAtNight.reasons.length > 0
        ? submission.wakeAtNight.reasons
            .map((r) => {
              switch (r) {
                case "eat":
                  return "to eat";
                case "drink":
                  return "to drink";
                case "pee":
                  return "to urinate";
                case "no_reason":
                  return "for no apparent reason";
              }
            })
            .join(", ")
        : "reasons not specified";
    lines.push(`**Wakes in the middle of the night:** Yes (${reasons})`);
  } else {
    lines.push(`**Wakes in the middle of the night:** No`);
  }

  lines.push(
    `**Brain fog / impaired cognition:** ${submission.brainFog ? "Yes" : "No"}`
  );

  if (submission.bowelIssues.length > 0) {
    const issues = submission.bowelIssues
      .map((i) => {
        switch (i) {
          case "straining":
            return "straining";
          case "pain":
            return "pain";
          case "incomplete":
            return "incomplete emptying";
          case "diarrhea":
            return "diarrhea";
          case "smell":
            return "excessive smell/messiness";
        }
      })
      .join(", ");
    lines.push(`**Bowel issues:** ${issues}`);
  } else {
    lines.push(`**Bowel issues:** None reported`);
  }

  lines.push(
    `**Frequently cold (extremities):** ${submission.coldExtremities ? "Yes" : "No"}`
  );

  lines.push(
    `**White tongue coating:** ${submission.whiteTongue ? "Yes" : "No"}`
  );

  lines.push(`**Typical eating pattern:**\n${submission.typicalEating}`);

  lines.push(`**Health goals:**\n${submission.healthGoals}`);

  return lines.join("\n\n");
}

export async function buildQuizSystemPrompt(submission: QuizSubmission) {
  const { knowledgeBase, questionnaireGuide, dietLifestyleGuide } =
    await loadKnowledge();

  const formattedAnswers = formatAnswers(submission);

  const prompt = `
# Context

You are assisting Prism Health, a bioenergetic health practice. A prospective client has just completed a brief health assessment quiz. Your role is to analyze their answers holistically and identify the most important health patterns through the bioenergetic lens.

# Knowledge Foundation

<bioenergetic_knowledge>
${knowledgeBase}
</bioenergetic_knowledge>

<symptom_interpretation_guide>
${questionnaireGuide}
</symptom_interpretation_guide>

<diet_lifestyle_context>
${dietLifestyleGuide}
</diet_lifestyle_context>

# Client's Quiz Answers

${formattedAnswers}

# Your Task

Analyze all answers holistically. Look for how symptoms interconnect and cluster into meaningful patterns. Identify the **3 most important patterns** that emerge from their responses.

For each pattern:
- Give it a clear, descriptive title
- Provide a brief explanation (2-3 sentences) that:
  - References their specific answers
  - Explains the bioenergetic mechanism in accessible language
  - Connects to their stated health goals where relevant

# Output Format

Write in a warm, professional tone. Speak as the Prism team using "we" language. Keep explanations concise and accessible - this is for a prospect, not a clinical report.

Structure your response as:

## Your Health Assessment

[1-2 sentence personalized opening acknowledging their situation]

### [Pattern 1 Title]

[2-3 sentence explanation]

### [Pattern 2 Title]

[2-3 sentence explanation]

### [Pattern 3 Title]

[2-3 sentence explanation]

---

These patterns often interconnect in ways that a comprehensive consultation can fully uncover. We'd love to explore your unique situation in more depth.

[Book a consultation](https://prism.miami/booking) to start your journey toward better health.

# Important

- Do NOT include recommendations or protocols
- Do NOT include citations
- Keep it brief and engaging - this is a lead generation tool
- Focus on insight and connection, not diagnosis
`.trim();

  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

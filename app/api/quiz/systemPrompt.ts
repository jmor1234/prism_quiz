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

  lines.push(`**Name:** ${submission.name}`);

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

Analyze the answers holistically. Identify the meaningful patterns that emerge—how symptoms interconnect, what they suggest about underlying energy and metabolism. Let the data guide how many patterns you surface.

For each pattern: give it a clear title and a brief explanation that references their specific answers and connects to their goals.

# Output Format

Warm, professional tone. Speak as Prism using "we" language. Concise and accessible—this is for a prospect, not a clinical report.

## Your Health Assessment

[Personalized opening]

### [Pattern Title]
[Brief explanation]

[Additional patterns as they naturally emerge]

---

[Closing invitation - see guidance below]

# Closing Guidance

You MUST end with an invitation to a free consultation. This is required - every assessment needs this closing. However, HOW you write it is flexible. It should feel like a natural extension of the assessment, not a tacked-on sales pitch.

**What to convey:**
- A quiz identifies patterns, but a real conversation can go deeper into their unique situation
- The consultation is completely free—no charge, no obligation
- They'll speak with a real person from Prism who understands bioenergetic health
- Include the link: https://prism.miami/booking

**Tone:**
- Invitation, not pressure ("if you'd like to explore this further" not "book now")
- Connect to their specific patterns when it feels natural
- Honest about the quiz's limitations—this builds trust

# Important

- Do NOT include recommendations or protocols
- Do NOT include citations
- Keep it brief and engaging - this is a lead generation tool
- Focus on insight and connection, not diagnosis
- Do NOT use em dashes (—) in the output
- If the person provided a real name, use it to personalize the assessment (e.g., "Hi Sarah, ..."). If the name is clearly not real (e.g., "test", "asdf", "not putting my name", etc.), do not reference it - just write the assessment without using their name.
`.trim();

  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

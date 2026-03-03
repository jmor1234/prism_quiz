// app/api/quiz/systemPrompt.ts

import type { VariantConfig, QuizAnswers } from "@/lib/quiz/types";
import { formatAnswers } from "@/lib/quiz/formatAnswers";
import { promises as fs } from "node:fs";
import path from "node:path";

// Cache knowledge files after first load
let knowledgeBase: string | null = null;
let questionnaireGuide: string | null = null;
let dietLifestyleGuide: string | null = null;
let metabolismDeepDive: string | null = null;
let gutDeepDive: string | null = null;

async function loadKnowledge() {
  if (!knowledgeBase || !questionnaireGuide || !dietLifestyleGuide || !metabolismDeepDive || !gutDeepDive) {
    const knowledgeDir = path.join(process.cwd(), "lib", "knowledge");

    const [kb, qg, dl, md, gd] = await Promise.all([
      fs.readFile(path.join(knowledgeDir, "knowledge.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "questionaire.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "diet_lifestyle_standardized.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "metabolism_deep_dive.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "gut_deep_dive.md"), "utf-8"),
    ]);

    knowledgeBase = kb;
    questionnaireGuide = qg;
    dietLifestyleGuide = dl;
    metabolismDeepDive = md;
    gutDeepDive = gd;
  }
  return { knowledgeBase, questionnaireGuide, dietLifestyleGuide, metabolismDeepDive, gutDeepDive };
}

export async function buildQuizPrompt(
  variant: VariantConfig,
  name: string,
  answers: QuizAnswers
) {
  const { knowledgeBase, questionnaireGuide, dietLifestyleGuide, metabolismDeepDive, gutDeepDive } =
    await loadKnowledge();

  const formattedAnswers = formatAnswers(variant, name, answers);

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

## Deep Mechanistic Framework

The following provides the biochemical depth behind the bioenergetic model. This is your reasoning foundation: the mechanisms, cascades, and interconnections that explain WHY symptoms cluster together. Internalize these principles to reason dynamically about each person's unique patterns. Do NOT reproduce, cite, or directly reference this material in your output (unless its literally directly relevant) use it to think, not to quote.

<energy_metabolism_framework>
${metabolismDeepDive}
</energy_metabolism_framework>

<gut_health_framework>
${gutDeepDive}
</gut_health_framework>

${variant.promptOverlay ? `# Condition-Specific Guidance\n\n${variant.promptOverlay}\n` : ""}# Client's Quiz Answers

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
- Do NOT include a booking link - a booking button is provided separately below the assessment for the user to use. which you can mention in the closing.

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

// app/api/assessment/generate/prompt.ts

import type { IntakeStep } from "../types";
import { formatIntake } from "@/lib/assessment/formatIntake";
import { promises as fs } from "node:fs";
import path from "node:path";

// Cache knowledge files after first load
let knowledgeBase: string | null = null;
let metabolismDeepDive: string | null = null;
let gutDeepDive: string | null = null;
let prismProcess: string | null = null;

async function loadKnowledge() {
  if (!knowledgeBase || !metabolismDeepDive || !gutDeepDive || !prismProcess) {
    const knowledgeDir = path.join(process.cwd(), "lib", "knowledge");

    const [kb, md, gd, pp] = await Promise.all([
      fs.readFile(path.join(knowledgeDir, "knowledge.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "metabolism_deep_dive.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "gut_deep_dive.md"), "utf-8"),
      fs.readFile(path.join(knowledgeDir, "prism_process.md"), "utf-8"),
    ]);

    knowledgeBase = kb;
    metabolismDeepDive = md;
    gutDeepDive = gd;
    prismProcess = pp;
  }
  return { knowledgeBase, metabolismDeepDive, gutDeepDive, prismProcess };
}

export async function buildAssessmentPrompt(
  name: string | undefined,
  steps: IntakeStep[]
): Promise<{ system: string; userMessage: string }> {
  const { knowledgeBase, metabolismDeepDive, gutDeepDive, prismProcess } =
    await loadKnowledge();

  const system = `
# Context

You are writing a brief, personalized health assessment for Prism Health, an evidence-based bioenergetic health practice. The person completed a 5-question health intake and arrived through social media with no prior relationship with Prism. Your task is to write 2 paragraphs and a closing sentence that create genuine recognition of their situation and land why root-cause guidance matters for them specifically.

# Knowledge Foundation

The bioenergetic framework and mechanistic depth below are your reasoning foundation. Internalize these to reason dynamically about each person's unique patterns. Use them to think, not to quote.

<bioenergetic_knowledge>
${knowledgeBase}
</bioenergetic_knowledge>

<energy_metabolism_framework>
${metabolismDeepDive}
</energy_metabolism_framework>

<gut_health_framework>
${gutDeepDive}
</gut_health_framework>

<prism_process>
${prismProcess}
</prism_process>

# Your Task

Write exactly 2 paragraphs and a closing sentence.

**Paragraph 1: Their situation through the bioenergetic lens.**
Connect their specific symptoms through the underlying systems that link them. Show the pattern they haven't seen: why these aren't separate problems but expressions of the same root disruption. Reference their own words, what they've tried, how long they've been at this, and where they are now. Thread in why previous approaches likely missed the root cause. Mirror their own language — how they describe where they're at and what's been hard, not just the clinical facts. This paragraph should create the feeling: "someone finally understands what's going on with me."

**Paragraph 2: Why Prism's process is specifically right for their situation.**
Bridge from the pattern you identified to what actually resolving it requires. Connect their specific case to how Prism's process addresses the root systems involved, not just the surface symptoms. This isn't generic marketing. It's the natural conclusion of the analysis: given what you've just explained, here's what addressing it actually looks like and why trying to figure this out alone is unlikely to reach these deeper systems.

**Closing sentence:** One warm sentence that invites them to take the next step with Prism. Don't reference UI elements like "link below" or "button."

# Constraints

- Warm, direct, professional. Speak as Prism using "we" language.
- Plain prose only. No headings, no bullet points, no numbered lists, no diagrams.
- it should be digestable and easy to understand for the average person.
- No citations, no links, no references to research.
- No specific recommendations, protocols, supplements, or dosages.
- No em dashes.
- No marketing language or hard sell. Let the insight do the work.
- Must be readable on a phone screen in about a minute.
- Every sentence should earn its place. Tight, focused paragraphs over thorough ones.
- If the person provided a name, use it naturally. If the name is clearly not real (e.g., "test", "asdf", "x"), do not reference it.
- The interface provides a CTA button separately below your text. Do not duplicate it.
`.trim();

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userMessage = `Current date: ${dateFormatter.format(new Date())}\n\n# Intake Responses\n\n${formatIntake(name, steps)}`;

  return { system, userMessage };
}

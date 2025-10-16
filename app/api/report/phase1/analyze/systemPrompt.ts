// app/api/report/phase1/analyze/systemPrompt.ts

import type { Phase1Submission } from "@/lib/schemas/phase1";
import { BIOENERGETIC_KNOWLEDGE } from "@/app/api/chat/lib/bioenergeticKnowledge";
import { promises as fs } from "node:fs";
import path from "node:path";

// Load interpretation guides
let questionnaireGuide: string | null = null;
let takehomeGuide: string | null = null;

async function loadInterpretationGuides() {
  if (!questionnaireGuide || !takehomeGuide) {
    const dataDir = path.join(process.cwd(), "app", "api", "report", "phase1", "data");
    questionnaireGuide = await fs.readFile(
      path.join(dataDir, "questionaire.md"),
      "utf-8"
    );
    takehomeGuide = await fs.readFile(
      path.join(dataDir, "takehome.md"),
      "utf-8"
    );
  }
  return { questionnaireGuide, takehomeGuide };
}

export async function buildPhase1SystemPrompt(submission: Phase1Submission) {
  const { questionnaireGuide, takehomeGuide } = await loadInterpretationGuides();

  const prompt = `
${BIOENERGETIC_KNOWLEDGE}

<interpretation_guides>

<questionnaire_interpretation>
${questionnaireGuide}
</questionnaire_interpretation>

<takehome_interpretation>
${takehomeGuide}
</takehome_interpretation>

</interpretation_guides>

<client_data>

<questionnaire_responses>
${submission.questionnaireText}
</questionnaire_responses>

<takehome_assessment>
${submission.takehomeText}
</takehome_assessment>

<advisor_notes>
${submission.advisorNotesText}
</advisor_notes>

</client_data>

# Context: You are assisting Prism Health

Prism is a bioenergetic health company that creates personalized client reports using the foundational principles provided to you. You are generating this report for one of their clients based on their assessment data.

# Goal: Three-Phase Bioenergetic Health Report

Generate a comprehensive analysis that becomes the client's personalized health roadmap from Prism.

**Note:** Think clearly from first principles about the underlying bioenergetic mechanisms connecting symptoms, root causes, and interventions.

**Output Expectation:** Your streamed output becomes the client report. Do not output any text until you begin writing the final report in Phase 3. Use tools for all analysis, planning, and reasoning during Phases 1-2.

## Data Provided

**Interpretation guides:** Map questionnaire responses and take-home test results to bioenergetic implications. These define Prism's methodology for interpreting client data.

**Client data:** Raw questionnaire responses, take-home assessment results, and advisor consultation notes. Advisor notes carry heavy weight for analysis.

**Bioenergetic knowledge:** The foundational framework for understanding health through the three pillars (gut health, stress resilience, thyroid/energy production).

<phase_1>
## Phase 1: Identify Root Causes

**Goal:** Identify 2-5 fundamental root causes driving the client's symptoms.

**Authority hierarchy:**
- PRIMARY: Interpretation guides define how to map symptoms to root causes
- SECONDARY: Research tools primarily validate mechanisms and provide citations and a bit more context, but not the final recommendations.

Work the phase sequentially: stay in Phase 1 until both the analysis and the supporting research for root causes are complete. Use interpretation guides to surface hypotheses, then immediately deepen and validate them with research tools so the final Phase 1 output already reflects that evidence.
</phase_1>

<phase_2>
## Phase 2: Generate Recommendations

**Goal:** Obtain targeted interventions from Prism's curated databases.

**Process:** You may call the three recommendation tools multiple times with focused objectives and contexts. Compare outputs across calls and exercise judgment. The final recommendations included in the report MUST be selected from sub-agent outputs (do not invent items). Each tool call should request concise top picks. Each tool returns selections from its database with critical implementation details:

- **Diagnostics:** Test name, rationale, and where to get tested
- **Diet/Lifestyle:** Intervention name, rationale, and implementation guidance
- **Supplements:** Supplement/pharmaceutical name, rationale, exact dosage instructions, and where to purchase (with discount codes)

Then validate key recommendations with research tools for evidence-based backing.
Begin Phase 2 only after Phase 1's analysis and research are both complete; follow the same discipline here—run recommendation analysis, then complete the necessary research before moving to Phase 3.
</phase_2>

<phase_3>
## Phase 3: Client-Facing Synthesis

**Goal:** Explain what's broken, how it connects, and what to do.

**Focus:**
- Root causes with mechanisms and evidence
- Interconnections between causes through bioenergetic principles
- Recommendations with implementation details from Phase 2 tools

**Approach:** Ground all mechanistic claims in research with inline citations [Study Title](url).
</phase_3>

<output_structure>
## Output Structure (Client Report)

Use clean, readable Markdown with clear section headings; keep language concise, client-facing, and evidence-based with inline [Title](URL) citations.

1) Introduction
- 2-3 sentences, personalized to the client ("you"), summarizing what the report covers.
- Anchor the opening to the client's top concerns or advisor-note cues.

2) Prism Bioenergetic Philosophy (Brief)
- 2-4 sentences grounding the three pillars and energy cascades.
- Connect the framework to this client's context without introducing new claims.

3) Root Causes
- Identify 2-5 causes..
- For each cause: explain why it applies, tie to questionnaire/take-home/advisor data, summarize mechanisms (principles-first), state interconnections, and cite claims inline.

4) Recommendations
- Render three subsections as Markdown tables (Diagnostics, Diet & Lifestyle, Supplements & Pharmaceuticals); maximum seven rows each; include essential implementation details from tools; tie each item to targeted root causes.
- Keep tables scannable and cite evidence inline when referenced.

5) Conclusion
- 2-4 sentences summarizing how interventions address root causes and outlining next steps.
- Emphasize interconnections and principles; include safety or contraindications when material.


#Important: we want the report to have as minimal fluff as possible and just what is most relevant and important to the client.
A long report is NOT the goal.

markdown diagrams if relevant can help show interconnections and mechanisms.
</output_structure>
`.trim();

  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

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

## Data Provided

**Interpretation guides:** Map questionnaire responses and take-home test results to bioenergetic implications. These define Prism's methodology for interpreting client data.

**Client data:** Raw questionnaire responses, take-home assessment results, and advisor consultation notes. Advisor notes carry heavy weight for analysis.

**Bioenergetic knowledge:** The foundational framework for understanding health through the three pillars (gut health, stress resilience, thyroid/energy production).

## Phase 1: Identify Root Causes

**Goal:** Identify 2-5 fundamental root causes driving the client's symptoms.

**Authority hierarchy:**
- PRIMARY: Interpretation guides define how to map symptoms to root causes
- SECONDARY: Research tools validate mechanisms and provide citations

Use interpretation guides to identify root causes from client data. Research tools support your analysis with evidence and scientific backing.

## Phase 2: Generate Recommendations

**Goal:** Obtain targeted interventions from Prism's curated databases.

**Process:** Call the three recommendation tools with comprehensive context about the root causes and client. Each returns selections from its database (diagnostics, diet/lifestyle, supplements). Then validate key recommendations with research tools for evidence-based backing.

## Phase 3: Client-Facing Synthesis

**Goal:** Communicate the most important information clearly, concisely, and actionably to the client.

**Audience:** This is the client's personalized health roadmap from Prism. They need to understand what matters most and what to do about it.

**Approach:**
- Be concise — deliver essential insights without unnecessary length
- Show interconnections — explain how root causes, symptoms, and interventions connect through bioenergetic principles
- Provide evidence — include inline citations using markdown format [Study Title](https://url) immediately after claims for authority
- Be actionable — the client should know exactly what to do next and why with evidence and sources

**Structure approach:** Introduction → Root Causes Explained → Recommendations by Pillar → Implementation Plan → Expected Outcomes
`.trim();

  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

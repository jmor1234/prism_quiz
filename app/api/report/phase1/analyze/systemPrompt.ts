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

# You are analyzing a client case for Phase 1: Root Cause Analysis

Your task is to analyze the provided client data and generate a structured root-cause report that identifies the fundamental bioenergetic cascades driving this client's symptoms.

<interpretation_guides>

<questionnaire_interpretation_guide>
${questionnaireGuide}
</questionnaire_interpretation_guide>

<takehome_interpretation_guide>
${takehomeGuide}
</takehome_interpretation_guide>

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

## Your Tools

You have access to:
- **thinkTool**: Plan your analysis strategy
- **researchMemoryTool**: Track findings across your analysis
- **executeResearchPlanTool**: Research specific bioenergetic patterns or conditions if needed
- **targetedExtractionTool**: Deep-dive into specific sources if needed

## Analysis Approach

1. Use the **interpretation guides** to map the client's questionnaire responses and take-home test results to their bioenergetic implications
2. Identify patterns and cascades from the **advisor notes** which carry heavy weight for analysis
3. Synthesize findings through the three-pillar framework (gut health, stress resilience, thyroid/energy production)
4. Trace symptoms upstream to root causes

## Output Requirements

Generate a concise, structured report identifying:
1. Primary bioenergetic cascades
2. Root causes (gut, stress, thyroid/energy disruptions)
3. Key manifestations and symptoms
4. Connections between findings

Be thorough but concise. Focus on actionable root-cause insights.
`.trim();

  return [
    {
      role: "user" as const,
      content: prompt,
    },
  ];
}

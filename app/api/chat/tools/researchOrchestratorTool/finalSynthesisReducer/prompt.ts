import type { FinalSynthesisReducerInput } from './types';

export function getFinalSynthesisReducerPrompt(input: FinalSynthesisReducerInput): string {
  const { groupReports, researchPlan, currentDate } = input;

  const plan = `
### Research Plan Context
- Objective: "${researchPlan.focusedObjective}"
${researchPlan.focusAreas?.length ? `- Focus Areas:\n${researchPlan.focusAreas.map((a) => `  - ${a}`).join('\n')}` : ''}
${researchPlan.keyEntities?.length ? `- Key Entities: ${researchPlan.keyEntities.join(', ')}` : ''}`;

  const groupsSection = groupReports.length > 0
    ? `
### Group Syntheses (inputs)
${groupReports.map((g, idx) => `---\nGroup ${idx + 1} Final Document (markdown):\n\n${g.finalDocument}\n---`).join('\n')}`
    : `
### Group Syntheses (inputs)
- None.`;

  return `
You are the Merge Synthesis Agent. Combine multiple group-level final documents into a single, coherent, evidence-based final Markdown document for the objective.

Current Date: ${currentDate}
${plan}
${groupsSection}

Merge policy:
- Operate ONLY over the provided group final documents; do not introduce outside facts.
- Reconcile overlaps and contradictions; prefer the most authoritative or most recent sources when conflicts matter.
- Keep disciplined inline citations in [Title](URL) format immediately after claims; prefer strongest; deduplicate repeats.
- Lead with the direct answer, then minimal, well-structured synthesis. Be clear and concise.
- If evidence is insufficient on a key point, state uncertainty and the smallest next research step.

Output format:
- Output the final Markdown document with [Title](URL) citations.
 - Keep citations inline using [Title](URL) format only.
`;
}



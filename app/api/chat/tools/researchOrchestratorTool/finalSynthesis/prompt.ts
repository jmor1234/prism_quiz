import { FinalSynthesisAgentInput } from './types';

export const getFinalSynthesisPrompt = (
  input: FinalSynthesisAgentInput
): string => {
  const { consolidatedDocuments, researchPlan, currentDate } = input;

  const plan = `
### Research Plan Context
- Objective: "${researchPlan.focusedObjective}"
${researchPlan.focusAreas?.length ? `- Focus Areas:\n${researchPlan.focusAreas.map((a) => `  - ${a}`).join('\n')}` : ''}
${researchPlan.keyEntities?.length ? `- Key Entities: ${researchPlan.keyEntities.join(', ')}` : ''}`;

  const insights = consolidatedDocuments.length > 0
    ? `
### Essential Research Insights
${consolidatedDocuments
  .map(
    (doc, idx) => `---
Source ${idx + 1}: ${doc.url}
Primary Contribution: ${doc.primaryContribution}
Addresses: ${doc.addressedObjectives}
${doc.essentialFindings.length > 0 ? `Findings:\n${doc.essentialFindings
        .map((f) => `- ${f.finding}\n  Evidence: ${f.evidence}\n  Significance: ${f.significance}`)
        .join('\n')}` : ''}
---`
  )
  .join('\n')}`
    : `
### Essential Research Insights
- None.`;

  return `
You are the Final Synthesis Agent. Construct a coherent, evidence-based document from essential insights.

Current Date: ${currentDate}
${plan}
${insights}

Synthesis policy:
- Use only the provided consolidated documents; do not introduce outside facts.
- Place inline [Title](URL) citations immediately after claims; prefer strongest; deduplicate repeats.
- If sources conflict, note it and prefer the most authoritative or most recent; explain briefly.
- Lead with the direct answer, then supporting synthesis; be clear and concise but balance not leaving out important details.
- If evidence is insufficient, state the uncertainty and propose the smallest next research step.
- When recency matters, surface the most recent credible evidence.


**Your fundamental job is to provide the most important information relative to the research objective, with proper inline relevant citations, with as little waste or fluff as possible, you want to be very context effecient in your final outputs.**

Output format:
- Output the final Markdown document with [Title](URL) citations.
 - Keep citations inline using [Title](URL) format only.
`;
};



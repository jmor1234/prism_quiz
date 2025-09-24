import { ContentAnalysisAgentInput } from './types';

export const getContentAnalysisPrompt = ({
  url,
  fullText,
  focusedObjective,
  focusAreas,
  keyEntities,
  documentPublishedDate,
  currentDate,
}: ContentAnalysisAgentInput): string => {
  return `
Analyze this document for findings relevant to the research objective.

Research Objective: "${focusedObjective}"

Focus Areas:
${focusAreas.map((a) => `- ${a}`).join('\n')}

Key Entities:
${keyEntities.join(', ')}

Document URL: ${url}
Published: ${documentPublishedDate || 'Not Available'}
Current Date: ${currentDate}

<document>
${fullText}
</document>

Analysis policy:
- Use only this document; do not introduce outside facts.
- Extract findings that directly address the objective and focus areas; pay attention to key entities and their relationships.
- Provide brief verbatim evidence (short quotes) near each finding; avoid long quotes.
- Note contradictions, gaps, or caveats if present.
- Aim to be generally clear and concise.
- If evidence is insufficient for a finding, state that clearly.

Extract key insights with supporting evidence and a concise summary.
`;
};



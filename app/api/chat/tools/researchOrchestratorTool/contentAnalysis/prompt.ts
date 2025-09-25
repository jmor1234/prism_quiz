import { ContentAnalysisAgentInput } from './types';
import { BIOENERGETIC_KNOWLEDGE } from '@/app/api/chat/lib/bioenergeticKnowledge';

export const getContentAnalysisPrompt = ({
  url,
  fullText,
  focusedObjective,
  focusAreas,
  keyEntities,
  documentPublishedDate,
  currentDate,
}: ContentAnalysisAgentInput): string => {
  return `${BIOENERGETIC_KNOWLEDGE}

You are a content analyst for bioenergetic research. You extract findings through the lens of the energy cascade model.

Your role: Identify where findings fit in the hierarchy - are they discussing root causes (stress, toxins, diet), energy disruptions (mitochondrial, thyroid), consequences (inflammation, oxidative stress), or just manifestations (symptoms)?

Extract findings that reveal: Causal chains, energy connections, gut-systemic links, stress cascades, and interconnected effects. Even if the source doesn't explicitly make bioenergetic connections, identify evidence that fits the framework.

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



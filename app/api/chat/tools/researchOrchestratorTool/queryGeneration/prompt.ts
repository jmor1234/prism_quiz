import { QueryGenerationPromptInput } from './types';
import { BIOENERGETIC_KNOWLEDGE } from '@/app/api/chat/lib/bioenergeticKnowledge';

export const getQueryGenerationPrompt = ({
  focusedObjective,
  focusAreas,
  keyEntities,
  currentDate,
  recommendedCategories,
  timeConstraints,
}: QueryGenerationPromptInput): string => {
  return `${BIOENERGETIC_KNOWLEDGE}

You are a query generation specialist for a bioenergetic research system. You understand that symptoms have root causes in energy disruption, gut dysfunction, and stress cascades.

Your role: Generate queries that uncover the hidden connections - the gut issues behind brain symptoms, the energy failures behind "mysterious" conditions, the stress cascades behind chronic illness.

Success looks like: Queries that reveal root causes and energy connections, not just symptom descriptions. Queries that explore the three pillars (gut, stress, thyroid/energy) for any health topic.

Current date: ${currentDate}
If you need up-to-date information, consider adding the year 2025 explicitly.

Research objective: "${focusedObjective}"

Focus areas:
${focusAreas.map((area) => `- ${area}`).join('\n')}

Key entities: ${keyEntities.join(', ')}

${timeConstraints ? `Time constraints: ${timeConstraints.startDate ? `from ${timeConstraints.startDate}` : ''} ${timeConstraints.endDate ? `to ${timeConstraints.endDate}` : ''} (recency: ${timeConstraints.recencyRequired})` : ''}

${recommendedCategories?.length ? `Recommended categories: ${recommendedCategories.join(', ')}` : ''}

Your task:
Generate two complementary query sets that together comprehensively address the research objective.

- Neural queries: full sentences and nuanced questions that capture relationships and conceptual meaning.
- Keyword queries: concise, high-signal token combinations.

Ensure combined coverage addresses all essential aspects of the objective from different angles.
`;
};



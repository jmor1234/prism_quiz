import { QueryGenerationPromptInput } from './types';

export const getQueryGenerationPrompt = ({
  focusedObjective,
  focusAreas,
  keyEntities,
  currentDate,
  recommendedCategories,
  timeConstraints,
}: QueryGenerationPromptInput): string => {
  return `
You are a query generation specialist. Create a strategic combination of keyword and neural queries for the Exa search API.

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



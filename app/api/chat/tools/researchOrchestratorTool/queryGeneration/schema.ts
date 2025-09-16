import { z } from 'zod';

export const queryGenerationOutputSchema = z.object({
  queryStrategyRationale: z.string().describe(
    'Brief explanation of the query selection strategy and its relevance to the research goal.'
  ),
  keywordQueries: z.array(z.string()).describe(
    'Concise keyword-based queries optimized for Exa API searches.'
  ),
  neuralQueries: z.array(z.string()).describe(
    "Natural language queries more descriptive or conceptual optimized for Exa's semantic search capabilities."
  ),
}).describe('Generated queries and rationale optimized for a specific research sub-task using Exa API.');

export type QueryGenerationOutput = z.infer<typeof queryGenerationOutputSchema>;



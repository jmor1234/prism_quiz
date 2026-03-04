// app/api/chat/tools/readTool/readTool.ts

import { tool } from 'ai';
import { z } from 'zod';
import { getHighlights } from '../researchTool/exaSearch/exaClient';

export const readSourceTool = tool({
  description:
    'Get focused evidence from a specific source. Nearly instantaneous. Returns highlights selected by your query.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to read more from.'),
    query: z.string().describe('What to focus on. Excerpts are selected by relevance to this query.'),
  }),
  execute: async ({ url, query }) => {
    const start = Date.now();
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* */ }

    const result = await getHighlights(url, query);

    const totalChars = result.highlights.reduce((sum, h) => sum + h.length, 0);
    const resultTokens = Math.round(JSON.stringify(result).length / 4);
    console.log(`[Read]   ${domain} → "${query.substring(0, 60)}" · ${totalChars} chars · ${Date.now() - start}ms · ~${resultTokens} tok`);

    return result;
  },
});

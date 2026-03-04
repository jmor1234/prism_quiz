// app/api/chat/tools/reretrieveEvidenceTool/reretrieveEvidenceTool.ts

import { tool } from 'ai';
import { z } from 'zod';
import { searchExa } from './exaSearch/exaClient';

export const retrieveEvidenceTool = tool({
  description:
    'Find studies and sources relevant to a claim you are making. Nearly instantaneous. Searches by meaning, not keywords. Returns results with highlighted excerpts. Make parallel calls for different angles.',
  inputSchema: z.object({
    query: z.string().describe(
      'Describe the ideal document to find. Rich, descriptive queries outperform keywords.',
    ),
    includeText: z.string().optional().describe(
      'Term that MUST appear in results. Only for critical proper nouns or jargon. Max 5 words.',
    ),
    excludeText: z.string().optional().describe(
      'Term that MUST NOT appear in results. For filtering noise. Max 5 words.',
    ),
  }),
  execute: async ({ query, includeText, excludeText }) => {
    const start = Date.now();

    const response = await searchExa(query, {
      ...(includeText ? { includeText } : {}),
      ...(excludeText ? { excludeText } : {}),
    });

    const results = response.results.map((r) => ({
      url: r.url,
      title: r.title,
      highlights: r.highlights,
      publishedDate: r.publishedDate,
      author: r.author,
    }));

    const resultTokens = Math.round(JSON.stringify(results).length / 4);
    const filters = [includeText && `+${includeText}`, excludeText && `-${excludeText}`].filter(Boolean).join(' ');
    console.log(`[Search] "${query.substring(0, 80)}"${filters ? ` [${filters}]` : ''} → ${results.length} results · ${Date.now() - start}ms · ~${resultTokens} tok`);
    results.forEach((r, i) => {
      let domain = '';
      try { domain = new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* */ }
      console.log(`  ${i + 1}. ${domain} — ${r.title}`);
    });

    return results;
  },
});

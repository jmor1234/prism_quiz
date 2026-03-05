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


---

// app/api/chat/tools/researchTool/exaSearch/exaClient.ts


import Exa from 'exa-js';
import { exaRateLimiter } from './rateLimiter';
import type { ExaSearchResponse, ExaSearchResult, SearchOptions } from './types';

const exa = new Exa(process.env.EXA_API_KEY);

export async function searchExa(
  query: string,
  options?: SearchOptions,
): Promise<ExaSearchResponse> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.search(query, {
      type: 'auto' as const,
      numResults: 3,
      contents: {
        highlights: {
          maxCharacters: 1250,
        },
      },
      category: 'research paper',
      ...(options?.includeText ? { includeText: [options.includeText] } : {}),
      ...(options?.excludeText ? { excludeText: [options.excludeText] } : {}),
    });

    const results: ExaSearchResult[] = response.results.map((r) => ({
      url: r.url,
      title: r.title ?? '',
      publishedDate: r.publishedDate ?? null,
      author: r.author ?? null,
      highlights: (r as Record<string, unknown>).highlights as string[] ?? [],
    }));

    const costObj = (response as Record<string, unknown>).costDollars as Record<string, unknown> | undefined;
    const cost = typeof costObj?.total === 'number' ? costObj.total : 0;

    return { results, costDollars: cost };
  });
}

export async function getContents(
  url: string,
  maxCharacters: number = 400_000,
): Promise<string> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.getContents([url], {
      text: { maxCharacters },
    });

    const result = response.results[0];
    const text = (result as Record<string, unknown>)?.text as string | undefined;
    if (!text) {
      throw new Error(`No content retrieved from ${url}`);
    }

    return text;
  });
}

export async function getHighlights(
  url: string,
  query: string,
  maxCharacters: number = 10_000,
): Promise<{ url: string; title: string; highlights: string[] }> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.getContents([url], {
      highlights: { maxCharacters, query } as Record<string, unknown>,
    });

    const result = response.results[0];
    const highlights = (result as Record<string, unknown>).highlights as string[] ?? [];

    return {
      url: result.url,
      title: result.title ?? '',
      highlights,
    };
  });
}


---

// app/api/chat/tools/researchTool/exaSearch/rateLimiter.ts

/**
 * Promise-chained dispatch rate limiter.
 *
 * Controls when requests START (dispatch rate), but lets them EXECUTE concurrently.
 * Each call chains onto a pending dispatch promise, ensuring minimum interval between dispatches.
 *
 * No timers, no explicit queue — just promise chaining.
 */
export class RateLimiter {
  private lastDispatchTime = 0;
  private pendingDispatch: Promise<void> = Promise.resolve();
  private readonly intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const dispatch = this.pendingDispatch.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastDispatchTime;
      const waitMs = Math.max(0, this.intervalMs - elapsed);

      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }

      this.lastDispatchTime = Date.now();
    });

    // .catch prevents a broken dispatch from poisoning the entire chain
    this.pendingDispatch = dispatch.catch(() => {});

    await dispatch;
    return fn();
  }
}

function getConfiguredQps(): number {
  const envVal = process.env.EXA_RATE_LIMIT_QPS;
  if (envVal) {
    const parsed = parseFloat(envVal);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 10; // 33% cushion below Exa's 15 QPS limit
}

export const exaRateLimiter = new RateLimiter(getConfiguredQps());


---

// app/api/chat/tools/researchTool/exaSearch/types.ts

export interface ExaSearchResult {
  url: string;
  title: string;
  publishedDate: string | null;
  author: string | null;
  highlights: string[];
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
  costDollars: number;
}

export interface SearchOptions {
  includeText?: string;
  excludeText?: string;
}


---


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



---
// app/api/chat/tools/depthTool/types.ts

export interface Finding {
  insight: string;
  evidence: string;
}

export interface ExtractionOutput {
  findings: Finding[];
  summary: string;
}

export interface DepthToolOutput extends ExtractionOutput {
  url: string;
}


---


// app/api/chat/tools/depthTool/depthTool.ts

import { tool } from 'ai';
import { z } from 'zod';
import { getContents } from '../researchTool/exaSearch/exaClient';
import { extractFromDocument } from './extraction/agent';
import type { DepthToolOutput } from './types';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export const extractFindingsTool = tool({
  description:
    'Extract specific findings and evidence from a dense source. Returns structured findings you can cite.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL to extract information from.'),
    objective: z.string().describe('What specific information to look for in this source.'),
  }),
  execute: async ({ url, objective }): Promise<DepthToolOutput> => {
    const start = Date.now();
    const currentDate = dateFormatter.format(new Date());
    let domain = '';
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch { /* */ }

    const fullText = await getContents(url);
    const extraction = await extractFromDocument(fullText, objective, currentDate);

    const output = { ...extraction, url };
    const resultTokens = Math.round(JSON.stringify(output).length / 4);
    console.log(`[Depth]  ${domain} → "${objective.substring(0, 60)}" · ${extraction.findings.length} findings · ${Date.now() - start}ms · ~${resultTokens} tok`);

    return output;
  },
});


// app/api/chat/tools/depthTool/extraction/agent.ts

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { extractionSchema } from './schema';
import { getExtractionPrompt } from './prompt';
import { withRetry } from '../../../lib/llmRetry';
import type { ExtractionOutput } from '../types';

export async function extractFromDocument(
  fullText: string,
  objective: string,
  currentDate: string,
): Promise<ExtractionOutput> {
  return withRetry(
    async (signal) => {
      const { object } = await generateObject({
        model: google('gemini-3-flash-preview'),
        schema: extractionSchema,
        prompt: getExtractionPrompt(fullText, objective, currentDate),
        abortSignal: signal,
      });

      return object;
    },
    'extraction',
  );
}


// app/api/chat/tools/depthTool/extraction/prompt.ts

/**
 * Generates the complete prompt for depth extraction.
 *
 * Takes a document's full text and an extraction objective,
 * returns a prompt that guides targeted information extraction
 * for the primary agent.
 */
export const getExtractionPrompt = (
  fullText: string,
  objective: string,
  currentDate: string,
): string => {
  return `You are an extraction agent. A primary reasoning agent identified this source during web research as worth investigating further. Your job is to extract the most relevant information and return structured findings that the primary agent can use — the full text won't be available to it, only your findings.

Guidelines:
- Prefer direct quotes as evidence — they're the most trustworthy and traceable form.
- Ground every finding in the actual text. No fabrication.
- Focus on the highest-value findings for the objective. Not every paragraph is worth extracting — quality over exhaustiveness.
- Be concise — return only what matters.

---

Current date: ${currentDate}

Extraction objective: "${objective}"

Document content:
${fullText}`;
};
// app/api/chat/tools/depthTool/extraction/schema.ts

import { z } from 'zod';

export const extractionSchema = z.object({
  findings: z.array(z.object({
    insight: z.string().describe('Key finding relevant to the objective.'),
    evidence: z.string().describe('Direct quote or specific detail from the source.'),
  })).describe('Targeted findings from the source.'),
  summary: z.string().describe('Brief overall assessment of what this source contributes.'),
});

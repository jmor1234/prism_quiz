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

---


import { z } from 'zod';

export const extractionSchema = z.object({
  findings: z.array(z.object({
    insight: z.string().describe('Key finding relevant to the objective.'),
    evidence: z.string().describe('Direct quote or specific detail from the source.'),
  })).describe('Targeted findings from the source.'),
  summary: z.string().describe('Brief overall assessment of what this source contributes.'),
});

---

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


---
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


---

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

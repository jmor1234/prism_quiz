// app/api/assessment/generate/tools.ts

import Exa from "exa-js";
import { tool } from "ai";
import { z } from "zod";

// --- Exa client ---

if (!process.env.EXA_API_KEY) {
  throw new Error("EXA_API_KEY environment variable is not set");
}

const exa = new Exa(process.env.EXA_API_KEY);

// --- Rate limiter (promise-chained, 10 QPS) ---

let lastDispatch = Promise.resolve();
const MIN_INTERVAL_MS = 100;

function rateLimited<T>(fn: () => Promise<T>): Promise<T> {
  const next = lastDispatch
    .then(() => new Promise<void>((r) => setTimeout(r, MIN_INTERVAL_MS)))
    .then(fn);
  lastDispatch = next.then(
    () => {},
    () => {}
  );
  return next;
}

// --- Logging helpers ---

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function estimateTokens(obj: unknown): number {
  return Math.round(JSON.stringify(obj).length / 4);
}

// --- Tools ---

const searchTool = tool({
  description:
    "Semantic web search - finds scientific sources by meaning, not keywords. " +
    "Returns results with highlighted excerpts. Lightweight and fast. " +
    "The highlights are often sufficient to cite a source. " +
    "Make parallel calls for independent research angles.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Describe the ideal document to find. Rich, descriptive queries outperform keywords."
      ),
    includeText: z
      .string()
      .optional()
      .describe(
        "Term that MUST appear in results. Only for critical proper nouns or jargon. Max 5 words."
      ),
    excludeText: z
      .string()
      .optional()
      .describe(
        "Term that MUST NOT appear in results. For filtering noise. Max 5 words."
      ),
  }),
  execute: async ({ query, includeText, excludeText }) => {
    const start = Date.now();

    const results = await rateLimited(async () => {
      const response = await exa.search(query, {
        type: "auto",
        numResults: 3,
        category: "research paper",
        contents: {
          highlights: {
            maxCharacters: 1250,
          },
        },
        ...(includeText && { includeText: [includeText] }),
        ...(excludeText && { excludeText: [excludeText] }),
      });

      return response.results.map((r) => ({
        url: r.url,
        title: r.title,
        highlights: r.highlights,
        publishedDate: r.publishedDate ?? null,
        author: r.author ?? null,
      }));
    });

    const ms = Date.now() - start;
    const tok = estimateTokens(results);
    const filters = [
      includeText ? `+${includeText}` : "",
      excludeText ? `-${excludeText}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const filterStr = filters ? ` [${filters}]` : "";

    console.log(
      `[Assessment Search] "${query.slice(0, 80)}"${filterStr} → ${results.length} results · ${ms}ms · ~${tok} tok`
    );
    for (let i = 0; i < results.length; i++) {
      console.log(
        `  ${i + 1}. ${domain(results[i].url)} - ${results[i].title}`
      );
    }

    return results;
  },
});

const readTool = tool({
  description:
    "Get focused excerpts from a specific URL you already found. " +
    "Returns query-relevant highlights with more detail than search. " +
    "Use when a search result looks promising and you need more evidence from that source.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to read more from."),
    query: z
      .string()
      .describe(
        "What to focus on. Excerpts are selected by relevance to this query."
      ),
  }),
  execute: async ({ url, query }) => {
    const start = Date.now();

    const result = await rateLimited(async () => {
      const response = await exa.getContents([url], {
        highlights: {
          query,
          maxCharacters: 10_000,
        },
      });

      const r = response.results[0];
      if (!r) return { url, title: null, highlights: [] as string[] };

      return {
        url: r.url,
        title: r.title,
        highlights: r.highlights as string[],
      };
    });

    const ms = Date.now() - start;
    const chars = result.highlights.join("").length;
    const tok = estimateTokens(result);

    console.log(
      `[Assessment Read]   ${domain(url)} → "${query.slice(0, 60)}" · ${chars} chars · ${ms}ms · ~${tok} tok`
    );

    return result;
  },
});

export const assessmentTools = { search: searchTool, read: readTool };

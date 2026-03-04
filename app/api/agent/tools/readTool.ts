// app/api/agent/tools/readTool.ts

import { tool } from "ai";
import { z } from "zod";
import { getHighlights } from "./exaSearch/exaClient";

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export const readTool = tool({
  description:
    "Get focused evidence from a specific source you already found. Nearly instantaneous. " +
    "Returns highlights selected by your query. " +
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

    const result = await getHighlights(url, query);

    const ms = Date.now() - start;
    const chars = result.highlights.join("").length;
    const tok = Math.round(JSON.stringify(result).length / 4);

    console.log(
      `[Agent Read]   ${domain(url)} → "${query.slice(0, 60)}" · ${chars} chars · ${ms}ms · ~${tok} tok`
    );

    return result;
  },
});

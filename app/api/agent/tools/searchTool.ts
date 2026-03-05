// app/api/agent/tools/searchTool.ts

import { tool } from "ai";
import { z } from "zod";
import { searchExa } from "./exaSearch/exaClient";

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export const searchTool = tool({
  description:
    "Search for research to build your reasoning. Nearly instantaneous. " +
    "Use this as you think, not after. Searches by meaning, not keywords. " +
    "Returns results with highlighted excerpts, often sufficient to cite. " +
    "Make parallel calls for different research angles.",
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

    const { results } = await searchExa(query, {
      numResults: 3,
      category: "research paper",
      includeText,
      excludeText,
    });

    const ms = Date.now() - start;
    const tok = Math.round(JSON.stringify(results).length / 4);
    const filters = [
      includeText ? `+${includeText}` : "",
      excludeText ? `-${excludeText}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const filterStr = filters ? ` [${filters}]` : "";

    console.log(
      `[Agent Search] "${query.slice(0, 80)}"${filterStr} → ${results.length} results · ${ms}ms · ~${tok} tok`
    );
    for (let i = 0; i < results.length; i++) {
      console.log(
        `  ${i + 1}. ${domain(results[i].url)} - ${results[i].title}`
      );
    }

    return results;
  },
});

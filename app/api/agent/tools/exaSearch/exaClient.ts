// app/api/agent/tools/exaSearch/exaClient.ts

import Exa from "exa-js";
import { exaRateLimiter } from "./rateLimiter";
import type {
  ExaSearchResponse,
  ExaSearchResult,
  SearchOptions,
} from "./types";

const exa = new Exa(process.env.EXA_API_KEY);

export async function searchExa(
  query: string,
  options?: SearchOptions
): Promise<ExaSearchResponse> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.search(query, {
      type: "auto",
      numResults: options?.numResults ?? 3,
      contents: {
        highlights: {
          maxCharacters: 1250,
        },
      },
      ...(options?.category === null
        ? {}
        : {
            category: (options?.category ?? "research paper") as
              | "research paper"
              | "company"
              | "news"
              | "pdf"
              | "tweet"
              | "personal site"
              | "financial report"
              | "people",
          }),
      ...(options?.includeText ? { includeText: [options.includeText] } : {}),
      ...(options?.excludeText ? { excludeText: [options.excludeText] } : {}),
    });

    const results: ExaSearchResult[] = response.results.map((r) => ({
      url: r.url,
      title: r.title ?? "",
      publishedDate: r.publishedDate ?? null,
      author: r.author ?? null,
      highlights: r.highlights ?? [],
    }));

    const cost =
      typeof response.costDollars?.total === "number"
        ? response.costDollars.total
        : 0;

    return { results, costDollars: cost };
  });
}

export async function getContents(
  url: string,
  maxCharacters: number = 400_000
): Promise<string> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.getContents([url], {
      text: { maxCharacters },
    });

    const result = response.results[0];
    if (!result?.text) {
      throw new Error(`No content retrieved from ${url}`);
    }

    return result.text;
  });
}

export async function getHighlights(
  url: string,
  query: string,
  maxCharacters: number = 10_000
): Promise<{ url: string; title: string; highlights: string[] }> {
  return exaRateLimiter.schedule(async () => {
    const response = await exa.getContents([url], {
      highlights: { maxCharacters, query },
    });

    const result = response.results[0];

    return {
      url: result.url,
      title: result.title ?? "",
      highlights: result.highlights ?? [],
    };
  });
}

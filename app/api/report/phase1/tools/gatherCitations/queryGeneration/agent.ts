// app/api/report/phase1/tools/gatherCitations/queryGeneration/agent.ts

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { getLogger } from "@/app/api/chat/lib/traceLogger";
import { CitationQueryGenerationInput } from "./types";
import {
  citationQueryGenerationOutputSchema,
  CitationQueryGenerationOutput,
} from "./schema";
import { getCitationQueryPrompt } from "./prompt";

const TOOL_NAME = "citationQueryGenerator";
const MODEL = "gemini-2.5-flash-preview-09-2025";

export async function generateCitationQueries(
  input: CitationQueryGenerationInput
): Promise<CitationQueryGenerationOutput> {
  const logger = getLogger();

  logger?.logToolInternalStep(TOOL_NAME, "QUERY_GENERATION_START", {
    subsection: input.subsection,
    pattern: input.pattern,
  });

  console.log(
    `      → Query generator: creating queries for "${input.pattern}"...`
  );

  try {
    const { object: result, usage } = await generateObject({
      model: google(MODEL),
      schema: citationQueryGenerationOutputSchema,
      prompt: getCitationQueryPrompt(input),
    });

    logger?.logToolInternalStep(TOOL_NAME, "QUERY_GENERATION_SUCCESS", {
      subsection: input.subsection,
      pattern: input.pattern,
      queryCount: result.queries.length,
      usage,
    });

    console.log(
      `      ✓ Generated ${result.queries.length} queries for "${input.pattern}"`
    );
    result.queries.forEach((query, index) => {
      console.log(`        ${index + 1}. "${query}"`);
    });

    return result;
  } catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));

    logger?.logToolInternalStep(TOOL_NAME, "QUERY_GENERATION_ERROR", {
      subsection: input.subsection,
      pattern: input.pattern,
      error: { message: e.message, name: e.name },
    });

    console.error(
      `      ✗ Failed to generate queries for "${input.pattern}":`,
      e.message
    );

    throw new Error(
      `Query generation failed for pattern "${input.pattern}": ${e.message}`
    );
  }
}

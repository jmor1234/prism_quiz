// app/api/agent/tools/depthTool/extraction/agent.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { extractionSchema } from "./schema";
import { getExtractionPrompt } from "./prompt";
import { withRetry } from "../../../lib/llmRetry";
import type { ExtractionOutput } from "../types";

export async function extractFromDocument(
  fullText: string,
  objective: string,
  currentDate: string
): Promise<ExtractionOutput> {
  return withRetry(
    async (signal) => {
      const { object } = await generateObject({
        model: google("gemini-3-flash-preview"),
        schema: extractionSchema,
        prompt: getExtractionPrompt(fullText, objective, currentDate),
        abortSignal: signal,
      });

      return object;
    },
    "extraction"
  );
}

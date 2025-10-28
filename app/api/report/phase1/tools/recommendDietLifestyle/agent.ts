// app/api/report/phase1/tools/recommendDietLifestyle/agent.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { withRetry } from "@/app/api/chat/lib/llmRetry";
import { getPhaseTimeoutMs } from "@/app/api/chat/lib/retryConfig";
import { BIOENERGETIC_KNOWLEDGE } from "@/app/api/chat/lib/bioenergeticKnowledge";
import {
  recommendDietLifestyleOutputSchema,
  type RecommendDietLifestyleInput,
  type RecommendDietLifestyleOutput,
} from "./schema";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

// Cache the CSV database after first load
let cachedDietLifestyleDatabase: string | null = null;

async function loadDietLifestyleDatabase(): Promise<string> {
  if (cachedDietLifestyleDatabase) {
    return cachedDietLifestyleDatabase;
  }

  const dataDir = path.join(process.cwd(), "app", "api", "report", "phase1", "data");
  const csvPath = path.join(dataDir, "Prsim Data - Diet & Lifestyle.csv");

  cachedDietLifestyleDatabase = await fs.readFile(csvPath, "utf-8");

  console.log(`[recommendDietLifestyle] Loaded diet & lifestyle database: ${cachedDietLifestyleDatabase.length} chars`);

  return cachedDietLifestyleDatabase;
}

export async function generateDietLifestyleRecommendations(
  input: RecommendDietLifestyleInput
): Promise<RecommendDietLifestyleOutput> {
  const logger = getLogger();

  logger?.logToolInternalStep("recommendDietLifestyleTool", "LOAD_DATABASE", {});

  const dietLifestyleDb = await loadDietLifestyleDatabase();

  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${dietLifestyleDb}
</csv_database>

<requested_item>
${input.requestedItem}
</requested_item>

<client_context>
${JSON.stringify(input.clientContext, null, 2)}
</client_context>

<objective>
${input.objective}
</objective>

# Goal: Enrich Diet/Lifestyle Directive with Database Details

**Data provided:**
- CSV database: Prism's curated diet and lifestyle interventions with implementation guidance
- Requested item: Specific intervention from expert directives
- Client context: Personalization factors
- Objective: Strategic guidance

**Your job:** Find the best database match(es) for the requested item and enrich with implementation details.

**Decision logic:**
- If requested item clearly matches one database entry → return specific match with personalized rationale
- If requested item is ambiguous (multiple valid matches) → return 2-5 options with reasoning about differences

**Personalization:** Tailor rationale to client's specific context, concerns, and constraints.

**Note:** Think from first principles about which database entries best match the directive.`.trim();

  logger?.logToolInternalStep("recommendDietLifestyleTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await withRetry(
    (signal) =>
      generateObject({
        model: google("gemini-2.5-flash-preview-09-2025"),
        schema: recommendDietLifestyleOutputSchema,
        prompt,
        abortSignal: signal,
      }),
    {
      phase: "recommendDietLifestyle",
      timeoutMs: getPhaseTimeoutMs("recommendDietLifestyle"),
    }
  );

  logger?.logToolInternalStep("recommendDietLifestyleTool", "SUB_AGENT_COMPLETE", {
    resultType: result.object.match.type,
  });

  return result.object.match;
}

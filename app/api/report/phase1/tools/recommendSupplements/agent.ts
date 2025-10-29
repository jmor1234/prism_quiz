// app/api/report/phase1/tools/recommendSupplements/agent.ts

import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { withRetry } from "@/app/api/chat/lib/llmRetry";
import { getPhaseTimeoutMs } from "@/app/api/chat/lib/retryConfig";
import { BIOENERGETIC_KNOWLEDGE } from "@/app/api/chat/lib/bioenergeticKnowledge";
import {
  recommendSupplementsOutputSchema,
  type RecommendSupplementsInput,
  type RecommendSupplementsOutput,
} from "./schema";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

// Cache the CSV database after first load
let cachedSupplementsDatabase: string | null = null;

async function loadSupplementsDatabase(): Promise<string> {
  if (cachedSupplementsDatabase) {
    return cachedSupplementsDatabase;
  }

  const dataDir = path.join(process.cwd(), "app", "api", "report", "phase1", "data");
  const csvPath = path.join(dataDir, "Prsim Data - Supplements & Pharmaceuticals.csv");

  cachedSupplementsDatabase = await fs.readFile(csvPath, "utf-8");

  console.log(`[recommendSupplements] Loaded supplements database: ${cachedSupplementsDatabase.length} chars`);

  return cachedSupplementsDatabase;
}

export async function generateSupplementRecommendations(
  input: RecommendSupplementsInput
): Promise<RecommendSupplementsOutput> {
  const logger = getLogger();

  logger?.logToolInternalStep("recommendSupplementsTool", "LOAD_DATABASE", {});

  const supplementsDb = await loadSupplementsDatabase();

  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${supplementsDb}
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

# Goal: Enrich Supplement/Pharmaceutical Directive with Database Details

**Data provided:**
- CSV database: Prism's curated supplements and pharmaceuticals with dosage and sourcing details
  - Column 1: "Supplement or Pharmaceuticals" (name)
  - Column 2: "Rationale" (mechanism and use cases)
  - Column 4: "Dosage/Notes" (dosing instructions)
  - Column 5: "Provider" (where to purchase with markdown links [text](url) - PRESERVE EXACT FORMATTING, including discount codes)
- Requested item: Specific supplement from expert directives
- Client context: Personalization factors
- Objective: Strategic guidance

**Your job:** Find the best database match(es) for the requested item and enrich with dosage and sourcing details.

**Decision logic:**
- If requested item clearly matches one database entry → return specific match with personalized rationale
- If requested item is ambiguous (multiple valid matches) → return 2-5 options with reasoning about differences

**Personalization:** Tailor rationale to client's specific context, concerns, and constraints.

**Critical:** When extracting the Provider field, preserve markdown link formatting \`[text](url)\` exactly as written in the database when present. Some entries may only have plain text provider names without links - that's expected. Do not convert or reformat.

**Important:** Minimal fluff - only what's relevant and important. Clear, concise, interconnected. We dont need to be verbose here, just provide the information that is relevant and important.

**Note:** Think from first principles about which database entries best match the directive.`.trim();

  logger?.logToolInternalStep("recommendSupplementsTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await withRetry(
    (signal) =>
      generateObject({
        model: google("gemini-2.5-flash-preview-09-2025"),
        schema: recommendSupplementsOutputSchema,
        prompt,
        abortSignal: signal,
      }),
    {
      phase: "recommendSupplements",
      timeoutMs: getPhaseTimeoutMs("recommendSupplements"),
    }
  );

  logger?.logToolInternalStep("recommendSupplementsTool", "SUB_AGENT_COMPLETE", {
    resultType: result.object.match.type,
  });

  return result.object.match;
}

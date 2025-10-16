// app/api/report/phase1/tools/recommendSupplements/agent.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
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

  // Build the prompt
  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${supplementsDb}
</csv_database>

<root_causes>
${JSON.stringify(input.rootCauses, null, 2)}
</root_causes>

<client_context>
${JSON.stringify(input.clientContext, null, 2)}
</client_context>

<objective>
${input.objective}
</objective>

# Goal: Select Highest-Impact Supplements & Pharmaceuticals

**Data provided:**
- CSV database: Prism's curated supplements and pharmaceuticals with columns:
  - Column 1: "Supplement or Pharmaceuticals" (name)
  - Column 2: "Rationale" (mechanism and use cases)
  - Column 4: "Dosage/Notes" (dosing instructions and important notes)
  - Column 5: "Provider" (where to purchase, including discount codes)
- Root causes: What needs to be addressed — includes evidence, mechanism, severity
- Client context: Personalization factors — age, gender, primary concerns, constraints
- Objective: Strategic guidance from the primary agent

**Your job:** Match database supplements/pharmaceuticals to root causes and select the most impactful ones for resolution.

**Selection philosophy:** Prioritize supplements with the strongest root cause impact. When multiple options exist, favor those addressing high-severity causes or the client's primary concerns.

**Return limit:** Return at most 5 recommendations in this call.

**Note:** Think clearly from first principles about which supplements will create the most meaningful impact on the underlying mechanisms.`;

  logger?.logToolInternalStep("recommendSupplementsTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    schema: recommendSupplementsOutputSchema,
    prompt,
  });

  logger?.logToolInternalStep("recommendSupplementsTool", "SUB_AGENT_COMPLETE", {
    recommendationCount: result.object.recommendations.length,
  });

  return result.object;
}

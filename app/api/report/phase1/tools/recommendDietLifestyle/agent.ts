// app/api/report/phase1/tools/recommendDietLifestyle/agent.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
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

  // Build the prompt
  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${dietLifestyleDb}
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

# Goal: Select Highest-Impact Diet & Lifestyle Interventions

**Data provided:**
- CSV database: Prism's curated diet and lifestyle interventions — defines what's available
- Root causes: What needs to be addressed — includes evidence, mechanism, severity
- Client context: Personalization factors — age, gender, primary concerns, constraints
- Objective: Strategic guidance from the primary agent

**Your job:** Match database interventions to root causes and select the most impactful ones for resolution.

**Selection philosophy:** Prioritize interventions with the strongest root cause impact. When multiple options exist, favor those addressing high-severity causes or the client's primary concerns.`;

  logger?.logToolInternalStep("recommendDietLifestyleTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    schema: recommendDietLifestyleOutputSchema,
    prompt,
  });

  logger?.logToolInternalStep("recommendDietLifestyleTool", "SUB_AGENT_COMPLETE", {
    recommendationCount: result.object.recommendations.length,
  });

  return result.object;
}

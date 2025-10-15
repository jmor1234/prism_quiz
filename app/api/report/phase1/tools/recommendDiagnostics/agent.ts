// app/api/report/phase1/tools/recommendDiagnostics/agent.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { BIOENERGETIC_KNOWLEDGE } from "@/app/api/chat/lib/bioenergeticKnowledge";
import {
  recommendDiagnosticsOutputSchema,
  type RecommendDiagnosticsInput,
  type RecommendDiagnosticsOutput,
} from "./schema";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLogger } from "@/app/api/chat/lib/traceLogger";

// Cache the CSV database after first load
let cachedDiagnosticsDatabase: string | null = null;

async function loadDiagnosticsDatabase(): Promise<string> {
  if (cachedDiagnosticsDatabase) {
    return cachedDiagnosticsDatabase;
  }

  const dataDir = path.join(process.cwd(), "app", "api", "report", "phase1", "data");
  const csvPath = path.join(dataDir, "Prsim Data - Diagnostics_implications.csv");

  cachedDiagnosticsDatabase = await fs.readFile(csvPath, "utf-8");

  console.log(`[recommendDiagnostics] Loaded diagnostics database: ${cachedDiagnosticsDatabase.length} chars`);

  return cachedDiagnosticsDatabase;
}

export async function generateDiagnosticRecommendations(
  input: RecommendDiagnosticsInput
): Promise<RecommendDiagnosticsOutput> {
  const logger = getLogger();

  logger?.logToolInternalStep("recommendDiagnosticsTool", "LOAD_DATABASE", {});

  const diagnosticsDb = await loadDiagnosticsDatabase();

  // Build the prompt
  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${diagnosticsDb}
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

# Goal: Select Highest-Impact Diagnostic Tests

**Data provided:**
- CSV database: Prism's curated diagnostic tests with columns:
  - Column 1: "Diagnostic" (test name, often includes price)
  - Column 2: "Implication" (what the test measures and interpretations)
  - Column 5: "Where to get" (provider or lab source)
- Root causes: What needs to be investigated — includes evidence, mechanism, severity
- Client context: Personalization factors — age, gender, primary concerns, constraints
- Objective: Strategic guidance from the primary agent

**Your job:** Match database tests to root causes and select the most impactful ones for investigation.

**Selection philosophy:** Prioritize tests with the strongest root cause investigation value. When multiple options exist, favor those revealing mechanisms for high-severity causes or addressing the client's primary concerns.

**Note:** Think clearly from first principles about which tests provide the most meaningful insights into the underlying mechanisms.`;

  logger?.logToolInternalStep("recommendDiagnosticsTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    schema: recommendDiagnosticsOutputSchema,
    prompt,
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 8000 },
      },
    },
  });

  logger?.logToolInternalStep("recommendDiagnosticsTool", "SUB_AGENT_COMPLETE", {
    recommendationCount: result.object.recommendations.length,
  });

  return result.object;
}

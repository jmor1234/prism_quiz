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

  const prompt = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${diagnosticsDb}
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

# Goal: Enrich Diagnostic Directive with Database Details

**Data provided:**
- CSV database: Prism's curated diagnostic tests
  - Column 1: "Diagnostic" (test name, often includes price)
  - Column 2: "Implication" (what the test measures and interpretations)
  - Column 5: "Where to get" (provider or lab source)
- Requested item: Specific diagnostic from expert directives
- Client context: Personalization factors
- Objective: Strategic guidance

**Your job:** Find the best database match(es) for the requested item and enrich with implementation details.

**Decision logic:**
- If requested item clearly matches one database entry → return specific match with personalized rationale
- If requested item is ambiguous (multiple valid matches) → return 2-5 options with reasoning about differences

**Personalization:** Tailor rationale to client's specific context, concerns, and constraints.

**Note:** Think from first principles about which database entries best match the directive.`.trim();

  logger?.logToolInternalStep("recommendDiagnosticsTool", "INVOKE_SUB_AGENT", {
    promptLength: prompt.length,
  });

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    schema: recommendDiagnosticsOutputSchema,
    prompt,
  });

  logger?.logToolInternalStep("recommendDiagnosticsTool", "SUB_AGENT_COMPLETE", {
    resultType: result.object.match.type,
  });

  return result.object.match;
}

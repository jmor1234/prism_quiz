// app/api/report/phase1/tools/analyzeExistingLabs/agent.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { withRetry } from "@/lib/ai/llmRetry";
import { getPhaseTimeoutMs } from "@/lib/ai/retryConfig";
import { BIOENERGETIC_KNOWLEDGE } from "@/lib/knowledge/bioenergeticKnowledge";
import {
  analyzeExistingLabsOutputSchema,
  type AnalyzeExistingLabsInput,
  type AnalyzeExistingLabsOutput,
} from "./schema";
import { getSubmission } from "../../lib/asyncContext";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getLogger } from "@/lib/ai/traceLogger";

// Cache the CSV database after first load
let cachedDiagnosticsDatabase: string | null = null;

async function loadDiagnosticsDatabase(): Promise<string> {
  if (cachedDiagnosticsDatabase) {
    return cachedDiagnosticsDatabase;
  }

  const dataDir = path.join(process.cwd(), "app", "api", "report", "phase1", "data");
  const csvPath = path.join(dataDir, "Prsim Data - Diagnostics_implications.csv");

  cachedDiagnosticsDatabase = await fs.readFile(csvPath, "utf-8");

  console.log(`[analyzeExistingLabs] Loaded diagnostics database: ${cachedDiagnosticsDatabase.length} chars`);

  return cachedDiagnosticsDatabase;
}

export async function analyzeExistingLabs(
  input: AnalyzeExistingLabsInput
): Promise<AnalyzeExistingLabsOutput> {
  const logger = getLogger();
  const submission = getSubmission();

  logger?.logToolInternalStep("analyzeExistingLabsTool", "LOAD_DATABASE", {});

  const diagnosticsDb = await loadDiagnosticsDatabase();

  // Get PDFs from submission
  const labPdfs = submission?.labPdfs;
  if (!labPdfs || labPdfs.length === 0) {
    throw new Error("No lab PDFs available in submission");
  }

  logger?.logToolInternalStep("analyzeExistingLabsTool", "ACCESS_PDFS", {
    pdfCount: labPdfs.length,
  });

  const promptText = `${BIOENERGETIC_KNOWLEDGE}

<csv_database>
${diagnosticsDb}
</csv_database>

<client_profile>
${JSON.stringify(input.clientProfile, null, 2)}
</client_profile>

${input.analysisObjective ? `<analysis_objective>
${input.analysisObjective}
</analysis_objective>` : ''}

# Goal: Bioenergetic Lab Interpretation

Analyze the client's lab results from uploaded PDFs against Prism's diagnostic database.

**Intent:**
- Extract test results that exist in the database
- Match client values against Prism's optimal ranges
- Generate concise interpretations connecting each result to the client's specific symptoms through bioenergetic principles

**Context hierarchy:**
1. Client's specific result value
2. Prism's optimal range (when available)
3. Bioenergetic mechanism linking result to symptoms

Keep interpretations clear, concise, and directly relevant to this client's situation.`.trim();

  logger?.logToolInternalStep("analyzeExistingLabsTool", "INVOKE_SUB_AGENT", {
    promptLength: promptText.length,
    pdfCount: labPdfs.length,
  });

  // Build multimodal message with text prompt + PDF files
  const messageContent: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string; filename?: string }
  > = [
    {
      type: "text",
      text: promptText,
    },
    ...labPdfs.map((pdf) => ({
      type: "file" as const,
      data: pdf.data,
      mediaType: pdf.mediaType,
      filename: pdf.filename,
    })),
  ];

  // Log PDF accessibility confirmation
  console.log(`\n[analyzeExistingLabs] Multimodal message prepared:`);
  console.log(`  Text prompt: ${promptText.length} chars`);
  labPdfs.forEach((pdf, idx) => {
    const dataPreview = pdf.data.substring(0, 50);
    console.log(`  PDF ${idx + 1}: "${pdf.filename}"`);
    console.log(`    - Base64 length: ${pdf.data.length} chars`);
    console.log(`    - Data preview: ${dataPreview}...`);
    console.log(`    - Media type: ${pdf.mediaType}`);
  });
  console.log(`  Total content parts: ${messageContent.length} (1 text + ${labPdfs.length} PDF${labPdfs.length > 1 ? 's' : ''})\n`);

  const result = await withRetry(
    (signal) =>
      generateObject({
        model: anthropic("claude-sonnet-4-5-20250929"),
        schema: analyzeExistingLabsOutputSchema,
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        providerOptions: {
          anthropic: {
            max_tokens: 30000,
          },
        },
        abortSignal: signal,
      }),
    {
      phase: "analyzeExistingLabs",
      timeoutMs: getPhaseTimeoutMs("analyzeExistingLabs"),
    }
  );

  // Log token usage
  console.log(`\n[analyzeExistingLabs] Token Usage:`);
  console.log(`  Input tokens: ${result.usage.inputTokens?.toLocaleString() ?? 'n/a'}`);
  console.log(`  Output tokens: ${result.usage.outputTokens?.toLocaleString() ?? 'n/a'}`);
  console.log(`  Total tokens: ${(result.usage.totalTokens as number | undefined)?.toLocaleString() ?? 'n/a'}\n`);

  logger?.logToolInternalStep("analyzeExistingLabsTool", "SUB_AGENT_COMPLETE", {
    findingsCount: result.object.analysis.findings.length,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
    },
  });

  return result.object.analysis;
}

// app/api/report/phase1/tools/analyzeExistingLabs/agent.ts

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { BIOENERGETIC_KNOWLEDGE } from "@/app/api/chat/lib/bioenergeticKnowledge";
import {
  analyzeExistingLabsOutputSchema,
  type AnalyzeExistingLabsInput,
  type AnalyzeExistingLabsOutput,
} from "./schema";
import { getSubmission } from "../../lib/asyncContext";
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

# Goal: Educational Lab Analysis

**Data provided:**
- CSV database: Prism's diagnostic reference (test names, implications, optimal ranges)
- PDF files: Client's previous lab results
- Client profile: Symptoms and demographics
- Analysis objective: Strategic context

**Your job:** Extract lab results from PDFs, match against database, and generate educational analysis helping the client understand their results through a bioenergetic lens.

**Intent:**
- Only analyze tests found in the database
- Extract clean client result values
- Pull Prism's optimal ranges from database when available
- Generate rich explanations that educate the client on what each test is, what it measures, and what their specific result means for their bioenergetic function. Keep it clear concise and contextually relevant.

**Note:** Connect each result to the client's specific symptoms and bioenergetic principles.`.trim();

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

  const result = await generateObject({
    model: anthropic("claude-sonnet-4-5-20250929"),
    schema: analyzeExistingLabsOutputSchema,
    messages: [
      {
        role: "user",
        content: messageContent,
      },
    ],
  });

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

// app/api/report/phase1/pdf/route.ts

import { getPhase1Result } from "@/server/phase1Results";
import { markdownToHtml } from "./lib/markdownToHtml";
import { generatePdf } from "./lib/generatePdf";
import { processMarkdown } from "./lib/markdownProcessor";
import { buildReportHtml } from "./lib/templateBuilder";

/**
 * Sanitize client name for use in filename
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove special characters (keep only alphanumeric and hyphens)
 * - Collapse multiple hyphens into one
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '')     // Remove special characters
    .replace(/-+/g, '-')            // Collapse multiple hyphens
    .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
}

/**
 * PDF Export API Endpoint
 *
 * Converts a stored Phase 1 report (markdown) to a professionally formatted PDF
 * with branded cover page, section dividers, and Prism styling
 *
 * Flow:
 * 1. Load report markdown from storage by caseId
 * 2. Process markdown to extract client name and section boundaries
 * 3. Convert each section markdown → HTML using unified pipeline
 * 4. Build complete HTML with cover page, dividers, and styled sections
 * 5. Generate PDF using Puppeteer with print-optimized CSS
 * 6. Return PDF as downloadable file
 *
 * Request: POST { caseId: string }
 * Response: application/pdf with Content-Disposition header
 */

export const maxDuration = 60; // 60 seconds - PDF generation can take time

export async function POST(req: Request) {
  try {
    // 1. Parse and validate request
    const body = (await req.json()) as { caseId: string };
    const { caseId } = body;

    if (!caseId || typeof caseId !== "string") {
      return new Response(
        JSON.stringify({ error: "caseId is required and must be a string" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`\n[PDF Export] Starting export for case: ${caseId}`);

    // 2. Load report from storage
    const result = await getPhase1Result(caseId);

    if (!result) {
      console.error(`[PDF Export] Case not found: ${caseId}`);
      return new Response(
        JSON.stringify({ error: `Report not found for caseId: ${caseId}` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[PDF Export] Report loaded (${result.report.length} chars)`);

    // 3. Process markdown to extract metadata and sections
    console.log("[PDF Export] Processing markdown sections...");
    const processedReport = processMarkdown(result.report);
    console.log(`[PDF Export] Client name: ${processedReport.clientName}`);

    // 4. Convert each section markdown to HTML
    console.log("[PDF Export] Converting markdown sections to HTML...");
    const convertedSections = {
      beforeIntroduction: await markdownToHtml(processedReport.sections.beforeIntroduction),
      introduction: await markdownToHtml(processedReport.sections.introduction),
      recommendations: await markdownToHtml(processedReport.sections.recommendations),
      references: processedReport.sections.references 
        ? await markdownToHtml(processedReport.sections.references)
        : "",
    };
    console.log("[PDF Export] HTML sections generated");

    // 5. Build complete HTML with cover page, dividers, and styled sections
    console.log("[PDF Export] Building complete HTML with templates...");
    const htmlContent = await buildReportHtml(processedReport, convertedSections);
    console.log(`[PDF Export] Complete HTML generated (${htmlContent.length} chars)`);

    // 6. Generate PDF
    console.log("[PDF Export] Generating PDF...");
    const pdfBuffer = await generatePdf(htmlContent);

    // 5. Return PDF as downloadable file
    // Use sanitized client name if available, fallback to caseId
    const sanitizedName = processedReport.clientName 
      ? sanitizeFilename(processedReport.clientName)
      : caseId;
    const filename = `prism-report-${sanitizedName}.pdf`;

    console.log(`[PDF Export] Export complete: ${filename} (${pdfBuffer.length} bytes)\n`);

    // Convert Uint8Array to Buffer and then to Blob for proper Response body type
    const buffer = Buffer.from(pdfBuffer);
    const pdfBlob = new Blob([buffer], { type: "application/pdf" });

    return new Response(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[PDF Export] Error:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during PDF generation",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

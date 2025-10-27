// app/api/report/phase1/pdf/route.ts

import { getPhase1Result } from "@/server/phase1Results";
import { markdownToHtml } from "./lib/markdownToHtml";
import { generatePdf } from "./lib/generatePdf";

/**
 * PDF Export API Endpoint
 *
 * Converts a stored Phase 1 report (markdown) to a professionally formatted PDF
 *
 * Flow:
 * 1. Load report markdown from storage by caseId
 * 2. Convert markdown → HTML using unified pipeline (same as frontend)
 * 3. Generate PDF using Puppeteer with print-optimized CSS
 * 4. Return PDF as downloadable file
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

    // 3. Convert markdown to HTML
    console.log("[PDF Export] Converting markdown to HTML...");
    const htmlContent = await markdownToHtml(result.report);
    console.log(`[PDF Export] HTML generated (${htmlContent.length} chars)`);

    // 4. Generate PDF
    console.log("[PDF Export] Generating PDF...");
    const pdfBuffer = await generatePdf(htmlContent);

    // 5. Return PDF as downloadable file
    const filename = `prism-report-${caseId}.pdf`;

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

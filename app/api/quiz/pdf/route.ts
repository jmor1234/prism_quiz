// app/api/quiz/pdf/route.ts

import { getQuizResult } from "@/server/quizResults";
import { markdownToHtml } from "@/lib/pdf/markdownToHtml";
import { generatePdf } from "@/lib/pdf/generatePdf";
import { buildQuizHtml } from "./lib/quizTemplateBuilder";

/**
 * Quiz PDF Export API Endpoint
 *
 * Converts a stored quiz assessment (markdown) to a branded PDF
 *
 * Flow:
 * 1. Load quiz result markdown from storage by quizId
 * 2. Convert markdown → HTML using unified pipeline
 * 3. Build complete HTML with cover page and content section
 * 4. Generate PDF using Puppeteer
 * 5. Return PDF as downloadable file
 *
 * Request: POST { quizId: string }
 * Response: application/pdf with Content-Disposition header
 */

export const maxDuration = 60; // 60 seconds - PDF generation can take time

export async function POST(req: Request) {
  try {
    // 1. Parse and validate request
    const body = (await req.json()) as { quizId: string };
    const { quizId } = body;

    if (!quizId || typeof quizId !== "string") {
      return new Response(
        JSON.stringify({ error: "quizId is required and must be a string" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`\n[Quiz PDF Export] Starting export for quiz: ${quizId}`);

    // 2. Load quiz result from storage
    const result = await getQuizResult(quizId);

    if (!result) {
      console.error(`[Quiz PDF Export] Quiz not found: ${quizId}`);
      return new Response(
        JSON.stringify({ error: `Quiz result not found for quizId: ${quizId}` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Quiz PDF Export] Result loaded (${result.report.length} chars)`);

    // 3. Convert markdown to HTML
    console.log("[Quiz PDF Export] Converting markdown to HTML...");
    const htmlContent = await markdownToHtml(result.report);
    console.log("[Quiz PDF Export] HTML generated");

    // 4. Build complete HTML with cover page
    console.log("[Quiz PDF Export] Building complete HTML with template...");
    const fullHtml = await buildQuizHtml(htmlContent);
    console.log(`[Quiz PDF Export] Complete HTML generated (${fullHtml.length} chars)`);

    // 5. Generate PDF
    console.log("[Quiz PDF Export] Generating PDF...");
    const pdfBuffer = await generatePdf(fullHtml);

    // 6. Return PDF as downloadable file
    const filename = `prism-assessment-${quizId.slice(0, 8)}.pdf`;

    console.log(`[Quiz PDF Export] Export complete: ${filename} (${pdfBuffer.length} bytes)\n`);

    // Convert Uint8Array to Buffer and then to Blob
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
    console.error("[Quiz PDF Export] Error:", error);

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

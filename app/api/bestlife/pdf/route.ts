// app/api/bestlife/pdf/route.ts
//
// User-facing PDF export for the best-life-care quiz variant. Mirrors
// /api/quiz/pdf but reads from the isolated bestlife-results storage.
// Reuses the variant-agnostic buildQuizHtml template.

import { getBestLifeResult } from "@/server/bestLifeResults";
import { markdownToHtml } from "@/lib/pdf/markdownToHtml";
import { generatePdf } from "@/lib/pdf/generatePdf";
import { buildQuizHtml } from "@/app/api/quiz/pdf/lib/quizTemplateBuilder";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { quizId: string };
    const { quizId } = body;

    if (!quizId || typeof quizId !== "string") {
      return new Response(
        JSON.stringify({ error: "quizId is required and must be a string" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`\n[BestLife PDF] Starting export for: ${quizId}`);

    const result = await getBestLifeResult(quizId);

    if (!result) {
      console.error(`[BestLife PDF] Not found: ${quizId}`);
      return new Response(
        JSON.stringify({ error: `Quiz result not found for quizId: ${quizId}` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const htmlContent = await markdownToHtml(result.report);
    const fullHtml = await buildQuizHtml(htmlContent);
    const pdfBuffer = await generatePdf(fullHtml);

    const filename = `prism-best-life-care-${quizId.slice(0, 8)}.pdf`;

    console.log(`[BestLife PDF] Export complete: ${filename} (${pdfBuffer.length} bytes)\n`);

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
    console.error("[BestLife PDF] Error:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during PDF generation",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// app/api/assessment/pdf/route.ts

import { getAssessmentResult } from "@/server/assessmentResults";
import { markdownToHtml } from "@/lib/pdf/markdownToHtml";
import { generatePdf } from "@/lib/pdf/generatePdf";
import { buildAssessmentHtml } from "./lib/assessmentTemplateBuilder";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { assessmentId: string };
    const { assessmentId } = body;

    if (!assessmentId || typeof assessmentId !== "string") {
      return new Response(
        JSON.stringify({
          error: "assessmentId is required and must be a string",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `\n[Assessment PDF Export] Starting export for: ${assessmentId}`
    );

    const result = await getAssessmentResult(assessmentId);

    if (!result) {
      console.error(
        `[Assessment PDF Export] Result not found: ${assessmentId}`
      );
      return new Response(
        JSON.stringify({
          error: `Assessment result not found for: ${assessmentId}`,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(
      `[Assessment PDF Export] Result loaded (${result.report.length} chars)`
    );

    console.log("[Assessment PDF Export] Converting markdown to HTML...");
    const htmlContent = await markdownToHtml(result.report);

    console.log("[Assessment PDF Export] Building complete HTML...");
    const fullHtml = await buildAssessmentHtml(htmlContent);

    console.log("[Assessment PDF Export] Generating PDF...");
    const pdfBuffer = await generatePdf(fullHtml);

    const filename = `prism-assessment-${assessmentId.slice(0, 8)}.pdf`;
    console.log(
      `[Assessment PDF Export] Complete: ${filename} (${pdfBuffer.length} bytes)\n`
    );

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
    console.error("[Assessment PDF Export] Error:", error);

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

// app/api/admin/best-life-care/pdf/route.ts
//
// Admin PDF export for a best-life-care submission. Reads from bestlife-*
// storage and reuses the shared adminPdfTemplate (which now handles
// yes_no_with_text rendering).

import { NextRequest } from "next/server";
import { getBestLifeSubmission } from "@/server/bestLifeSubmissions";
import { getBestLifeResult } from "@/server/bestLifeResults";
import { getBestLifeEngagement } from "@/server/bestLifeEngagement";
import { markdownToHtml } from "@/lib/pdf/markdownToHtml";
import { generatePdf } from "@/lib/pdf/generatePdf";
import { buildAdminPdfHtml } from "@/app/api/admin/results/pdf/lib/adminPdfTemplate";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("[BestLife Admin PDF] ADMIN_PASSWORD not set");
      return Response.json({ error: "Admin not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || key !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { quizId: string };
    const { quizId } = body;

    if (!quizId || typeof quizId !== "string") {
      return Response.json({ error: "quizId is required" }, { status: 400 });
    }

    console.log(`[BestLife Admin PDF] Starting export for: ${quizId}`);

    const [submission, result, engagement] = await Promise.all([
      getBestLifeSubmission(quizId),
      getBestLifeResult(quizId),
      getBestLifeEngagement(quizId),
    ]);

    if (!submission) {
      console.error(`[BestLife Admin PDF] Not found: ${quizId}`);
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    const reportHtml = result?.report
      ? await markdownToHtml(result.report)
      : "";

    const fullHtml = buildAdminPdfHtml({
      quizId,
      createdAt: submission.createdAt,
      variant: submission.variant,
      name: submission.name,
      answers: submission.answers,
      reportHtml,
      summary: engagement?.summary ?? null,
    });

    const pdfBuffer = await generatePdf(fullHtml);

    const sanitizedName = (submission.name || "anonymous")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    const filename = `${sanitizedName || "anonymous"}-bestlife-${quizId.slice(0, 8)}.pdf`;

    console.log(
      `[BestLife Admin PDF] Export complete: ${filename} (${pdfBuffer.length} bytes)`
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
    console.error("[BestLife Admin PDF] Error:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unknown error during PDF generation",
      },
      { status: 500 }
    );
  }
}

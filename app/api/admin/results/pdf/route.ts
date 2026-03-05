// app/api/admin/results/pdf/route.ts

import { NextRequest } from "next/server";
import { getQuizSubmission } from "@/server/quizSubmissions";
import { getQuizResult } from "@/server/quizResults";
import { getEngagement } from "@/server/quizEngagement";
import { markdownToHtml } from "@/lib/pdf/markdownToHtml";
import { generatePdf } from "@/lib/pdf/generatePdf";
import { buildAdminPdfHtml } from "./lib/adminPdfTemplate";

/**
 * Admin PDF Export API Endpoint
 *
 * Exports a quiz entry (submission + AI assessment) as a branded PDF
 *
 * Auth: Query param `key` must match ADMIN_PASSWORD env var
 * Request: POST { quizId: string }
 * Response: application/pdf with Content-Disposition header
 */

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error("[Admin PDF] ADMIN_PASSWORD not configured");
      return Response.json({ error: "Admin not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || key !== adminPassword) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request
    const body = (await request.json()) as { quizId: string };
    const { quizId } = body;

    if (!quizId || typeof quizId !== "string") {
      return Response.json({ error: "quizId is required" }, { status: 400 });
    }

    console.log(`[Admin PDF] Starting export for quiz: ${quizId}`);

    // 3. Fetch data in parallel
    const [submission, result, engagement] = await Promise.all([
      getQuizSubmission(quizId),
      getQuizResult(quizId),
      getEngagement(quizId),
    ]);

    if (!submission) {
      console.error(`[Admin PDF] Quiz not found: ${quizId}`);
      return Response.json({ error: "Quiz not found" }, { status: 404 });
    }

    console.log(`[Admin PDF] Data loaded for: ${submission.name}`);

    // 4. Convert markdown to HTML (if report exists)
    const reportHtml = result?.report
      ? await markdownToHtml(result.report)
      : "";

    // 5. Build complete HTML
    console.log("[Admin PDF] Building HTML template...");
    const fullHtml = buildAdminPdfHtml({
      quizId,
      createdAt: submission.createdAt,
      variant: submission.variant,
      name: submission.name,
      answers: submission.answers,
      reportHtml,
      summary: engagement?.summary ?? null,
    });

    // 6. Generate PDF
    console.log("[Admin PDF] Generating PDF...");
    const pdfBuffer = await generatePdf(fullHtml);

    // 7. Build filename (sanitize client name)
    const sanitizedName = submission.name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
    const filename = `${sanitizedName}-${quizId.slice(0, 8)}.pdf`;

    console.log(`[Admin PDF] Export complete: ${filename} (${pdfBuffer.length} bytes)`);

    // 8. Return PDF
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
    console.error("[Admin PDF] Error:", error);

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

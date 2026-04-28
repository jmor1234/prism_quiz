// app/api/bestlife/result/route.ts
//
// Result fetch for the best-life-care quiz variant. Mirrors /api/quiz/result
// but reads from the isolated bestlife-results storage namespace.

import { NextRequest, NextResponse } from "next/server";
import { getBestLifeResult, saveBestLifeResult } from "@/server/bestLifeResults";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const quizId = searchParams.get("quizId");

  if (!quizId || typeof quizId !== "string") {
    return NextResponse.json({ error: "quizId is required" }, { status: 400 });
  }

  try {
    const result = await getBestLifeResult(quizId);

    if (!result) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    return NextResponse.json({
      report: result.report,
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error("[BestLife Result] Failed to retrieve:", error);
    return NextResponse.json(
      { error: "Failed to retrieve result" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as { quizId?: string; report?: string };
    const { quizId, report } = body;

    if (!quizId || typeof quizId !== "string") {
      return NextResponse.json(
        { error: "quizId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!report || typeof report !== "string") {
      return NextResponse.json(
        { error: "report is required and must be a string" },
        { status: 400 }
      );
    }

    const existing = await getBestLifeResult(quizId);
    if (!existing) {
      return NextResponse.json({ error: "Result not found" }, { status: 404 });
    }

    await saveBestLifeResult({ id: quizId, report });

    console.log(`[BestLife Result] Report updated for quiz: ${quizId}`);

    return NextResponse.json({ success: true, quizId });
  } catch (error) {
    console.error("[BestLife Result] Failed to update:", error);
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 }
    );
  }
}

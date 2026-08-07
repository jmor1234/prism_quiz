// app/api/bestlife/result/route.ts
//
// Result fetch for the best-life-harbor quiz variant. Mirrors /api/quiz/result
// but reads from the isolated bestlife-results storage namespace.

// GET only, deliberately. A PATCH handler here previously let any caller
// overwrite a stored report, authenticated by nothing but the quizId — the
// same id the public "copy link to your results" URL hands out. It had no
// callers anywhere in the app. Removed rather than gated: an edit path that
// nothing uses is not worth an auth surface. If report editing is ever
// wanted, it belongs behind ADMIN_PASSWORD like the other admin writes, and
// results have no version history to restore from if overwritten.

import { NextRequest, NextResponse } from "next/server";
import { getBestLifeResult } from "@/server/bestLifeResults";

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

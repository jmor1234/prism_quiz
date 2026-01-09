// app/api/quiz/result/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getQuizResult, saveQuizResult } from "@/server/quizResults";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const quizId = searchParams.get("quizId");

  if (!quizId || typeof quizId !== "string") {
    return NextResponse.json(
      { error: "quizId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await getQuizResult(quizId);

    if (!result) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      report: result.report,
      createdAt: result.createdAt,
    });
  } catch (error) {
    console.error("Failed to retrieve quiz result:", error);
    return NextResponse.json(
      { error: "Failed to retrieve result" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { quizId?: string; report?: string };
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

    // Verify the quiz result exists before updating
    const existing = await getQuizResult(quizId);
    if (!existing) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    // Save the updated report (overwrites existing)
    await saveQuizResult({
      id: quizId,
      report,
    });

    console.log(`[Quiz Result] Report updated for quiz: ${quizId}`);

    return NextResponse.json({
      success: true,
      quizId,
    });
  } catch (error) {
    console.error("Failed to update quiz result:", error);
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 }
    );
  }
}

// app/api/report/phase1/result/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getPhase1Result } from "@/server/phase1Results";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const caseId = searchParams.get("caseId");

  if (!caseId || typeof caseId !== "string") {
    return NextResponse.json(
      { error: "caseId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await getPhase1Result(caseId);

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
    console.error("Failed to retrieve Phase 1 result:", error);
    return NextResponse.json(
      { error: "Failed to retrieve result" },
      { status: 500 }
    );
  }
}

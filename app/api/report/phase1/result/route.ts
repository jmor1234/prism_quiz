// app/api/report/phase1/result/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getPhase1Result, savePhase1Result } from "@/server/phase1Results";

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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as { caseId?: string; report?: string };
    const { caseId, report } = body;

    if (!caseId || typeof caseId !== "string") {
      return NextResponse.json(
        { error: "caseId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!report || typeof report !== "string") {
      return NextResponse.json(
        { error: "report is required and must be a string" },
        { status: 400 }
      );
    }

    // Verify the case exists before updating
    const existing = await getPhase1Result(caseId);
    if (!existing) {
      return NextResponse.json(
        { error: "Result not found" },
        { status: 404 }
      );
    }

    // Save the updated report (overwrites existing)
    await savePhase1Result({
      caseId,
      report,
    });

    console.log(`[Phase1 Result] Report updated for case: ${caseId}`);

    return NextResponse.json({
      success: true,
      caseId,
    });
  } catch (error) {
    console.error("Failed to update Phase 1 result:", error);
    return NextResponse.json(
      { error: "Failed to update result" },
      { status: 500 }
    );
  }
}

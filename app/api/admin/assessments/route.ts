// app/api/admin/assessments/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  listAssessmentResults,
  searchAssessmentResults,
} from "@/server/assessmentResults";
import { getAssessmentEngagementBatch } from "@/server/assessmentEngagement";

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("[Admin Assessments] ADMIN_PASSWORD not set");
    return NextResponse.json(
      { error: "Admin access not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const providedKey = searchParams.get("key");

  if (!providedKey || providedKey !== adminPassword) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;
    const search = searchParams.get("search")?.trim();

    let entries;
    let nextCursor: string | null = null;

    if (search) {
      entries = await searchAssessmentResults(search, limit);
    } else {
      const cursor = searchParams.get("cursor") ?? undefined;
      const result = await listAssessmentResults(limit, cursor);
      entries = result.entries;
      nextCursor = result.nextCursor;
    }

    // Batch-fetch engagement
    const engagementMap = await getAssessmentEngagementBatch(
      entries.map((e) => e.id)
    );
    const entriesWithEngagement = entries.map((e) => ({
      ...e,
      engagement: engagementMap.get(e.id) ?? null,
    }));

    return NextResponse.json({
      entries: entriesWithEngagement,
      nextCursor,
    });
  } catch (error) {
    console.error("[Admin Assessments] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assessments" },
      { status: 500 }
    );
  }
}

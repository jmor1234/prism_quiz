// app/api/admin/results/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listQuizEntries, searchQuizEntriesByName } from "@/server/quizSubmissions";
import { getEngagementBatch } from "@/server/quizEngagement";

/**
 * GET /api/admin/results
 * 
 * Returns list of quiz submissions with their AI assessments.
 * Requires password authentication via `key` query parameter.
 */
export async function GET(request: NextRequest) {
  // Check for admin password
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (!adminPassword) {
    console.error("[Admin API] ADMIN_PASSWORD environment variable not set");
    return NextResponse.json(
      { error: "Admin access not configured" },
      { status: 500 }
    );
  }

  // Get key from query params
  const { searchParams } = new URL(request.url);
  const providedKey = searchParams.get("key");

  if (!providedKey || providedKey !== adminPassword) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    // Get limit from query params (default 100)
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    // Get search term and variant filter from query params
    const search = searchParams.get("search")?.trim();
    const variant = searchParams.get("variant") ?? undefined;

    // If search is provided, search across entries (no pagination)
    let entries;
    let nextCursor: string | null = null;

    if (search) {
      entries = await searchQuizEntriesByName(search, limit, variant);
    } else {
      const cursor = searchParams.get("cursor") ?? undefined;
      const result = await listQuizEntries(limit, cursor, variant);
      entries = result.entries;
      nextCursor = result.nextCursor;
    }

    // Batch-fetch engagement data for all entries
    const engagementMap = await getEngagementBatch(entries.map((e: { id: string }) => e.id));
    const entriesWithEngagement = entries.map((e: { id: string }) => ({
      ...e,
      engagement: engagementMap.get(e.id) ?? null,
    }));

    return NextResponse.json({ entries: entriesWithEngagement, nextCursor });
  } catch (error) {
    console.error("[Admin API] Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

// app/api/admin/results/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listQuizEntries } from "@/server/quizSubmissions";

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

    const entries = await listQuizEntries(limit);

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[Admin API] Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

// app/api/admin/best-life-care/route.ts
//
// Admin listing for best-life-care submissions. Reads from the isolated
// bestlife-* storage namespace — never touches the standard quiz storage.
// Same ADMIN_PASSWORD auth pattern as the standard admin.

import { NextRequest, NextResponse } from "next/server";
import {
  listBestLifeEntries,
  searchBestLifeEntriesByName,
} from "@/server/bestLifeSubmissions";
import { getBestLifeEngagementBatch } from "@/server/bestLifeEngagement";

export async function GET(request: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("[BestLife Admin] ADMIN_PASSWORD not set");
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
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;
    const search = searchParams.get("search")?.trim();

    let entries;
    let nextCursor: string | null = null;

    if (search) {
      entries = await searchBestLifeEntriesByName(search, limit);
    } else {
      const cursor = searchParams.get("cursor") ?? undefined;
      const result = await listBestLifeEntries(limit, cursor);
      entries = result.entries;
      nextCursor = result.nextCursor;
    }

    const engagementMap = await getBestLifeEngagementBatch(
      entries.map((e: { id: string }) => e.id)
    );
    const entriesWithEngagement = entries.map((e: { id: string }) => ({
      ...e,
      engagement: engagementMap.get(e.id) ?? null,
    }));

    return NextResponse.json({ entries: entriesWithEngagement, nextCursor });
  } catch (error) {
    console.error("[BestLife Admin] Error fetching results:", error);
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}

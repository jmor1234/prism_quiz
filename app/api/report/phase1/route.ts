import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { upsertPhase1Case } from "@/server/phase1Cases";
import { phase1SubmissionSchema } from "@/lib/schemas/phase1";

export async function POST(request: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  try {
    const submission = phase1SubmissionSchema.parse(rawBody);
    const record = await upsertPhase1Case({ submission });

    return NextResponse.json(
      { caseId: record.caseId },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.format() }, { status: 400 });
    }

    console.error("Failed to persist phase1 submission", error);
    return NextResponse.json(
      { error: "Failed to persist submission" },
      { status: 500 },
    );
  }
}

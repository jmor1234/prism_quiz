import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { upsertPhase1Case } from "@/server/phase1Cases";
import { phase1SubmissionSchema } from "@/lib/schemas/phase1";
import { runPhase1Analysis } from "./runPhase1Analysis";

const runPhase1Schema = z.object({
  caseId: z.string().uuid(),
  force: z.boolean().optional(),
  currentDate: z.string().optional(),
});

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
    if (typeof rawBody === "object" && rawBody !== null && "questionnaireText" in rawBody) {
      const submission = phase1SubmissionSchema.parse(rawBody);
      const record = await upsertPhase1Case({ submission });

      return NextResponse.json(
        { caseId: record.caseId },
        { status: 201 },
      );
    }

    const { caseId, force, currentDate } = runPhase1Schema.parse(rawBody);
    const analysis = await runPhase1Analysis(caseId, { force, currentDate });

    return NextResponse.json(analysis, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.format() }, { status: 400 });
    }

    console.error("Phase 1 route error", error);
    return NextResponse.json(
      { error: "Phase 1 request failed" },
      { status: 500 },
    );
  }
}

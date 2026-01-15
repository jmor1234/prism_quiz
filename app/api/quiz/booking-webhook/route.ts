// app/api/quiz/booking-webhook/route.ts

import { NextResponse } from "next/server";
import { bookingWebhookSchema } from "@/lib/schemas/bookingWebhook";
import { getQuizSubmission } from "@/server/quizSubmissions";
import { getQuizResult } from "@/server/quizResults";
import { sendRepEmail } from "@/lib/email/sendRepEmail";

export async function POST(request: Request) {
  console.log("[Booking Webhook] Received request");

  // Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[Booking Webhook] Invalid JSON body");
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate payload
  const parseResult = bookingWebhookSchema.safeParse(body);
  if (!parseResult.success) {
    console.error("[Booking Webhook] Validation failed:", parseResult.error.flatten());
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    );
  }

  const payload = parseResult.data;
  console.log(`[Booking Webhook] Processing booking for ${payload.client.email}, quizId: ${payload.quizId || "(none)"}`);

  // Fetch quiz data if quizId is present
  let submission = null;
  let assessment = null;

  if (payload.quizId) {
    try {
      const submissionRecord = await getQuizSubmission(payload.quizId);
      if (submissionRecord) {
        submission = submissionRecord.submission;
        console.log(`[Booking Webhook] Found quiz submission for ${payload.quizId}`);
      } else {
        console.warn(`[Booking Webhook] No submission found for quizId: ${payload.quizId}`);
      }
    } catch (error) {
      console.error(`[Booking Webhook] Error fetching submission:`, error);
      // Continue without submission data
    }

    try {
      const resultRecord = await getQuizResult(payload.quizId);
      if (resultRecord) {
        assessment = resultRecord.report;
        console.log(`[Booking Webhook] Found quiz result for ${payload.quizId}`);
      } else {
        console.warn(`[Booking Webhook] No result found for quizId: ${payload.quizId}`);
      }
    } catch (error) {
      console.error(`[Booking Webhook] Error fetching result:`, error);
      // Continue without assessment data
    }
  }

  // Send email to rep
  try {
    await sendRepEmail({
      payload,
      submission,
      assessment,
    });
    console.log(`[Booking Webhook] Email sent to ${payload.rep.email}`);
  } catch (error) {
    console.error("[Booking Webhook] Failed to send email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

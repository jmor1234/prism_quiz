"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { buildBookingUrl } from "@/lib/utmStorage";

function trackEngagement(assessmentId: string, type: string) {
  fetch("/api/assessment/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assessmentId, type }),
    keepalive: true,
  }).catch(() => {});
}

function GoldRule() {
  return (
    <div className="flex items-center justify-center gap-3 py-1">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--quiz-gold)]/40 to-transparent" />
      <div className="w-1.5 h-1.5 rotate-45 bg-[var(--quiz-gold)]/60" />
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--quiz-gold)]/40 to-transparent" />
    </div>
  );
}

export function AssessmentResult({
  report,
  resultId,
  bookingUrl,
}: {
  report: string;
  resultId: string;
  bookingUrl: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const dur = shouldReduceMotion ? 0 : undefined;
  const ctaUrl = buildBookingUrl(bookingUrl);

  // Split report into paragraphs for styled rendering
  const paragraphs = report
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen quiz-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-end">
          <ModeToggle />
        </div>
      </header>

      <main className="flex-1 px-5 py-10 sm:px-6">
        <div className="max-w-xl mx-auto">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: dur ?? 0.6 }}
            className="text-center mb-8"
          >
            <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-[var(--quiz-gold-dark)] mb-3">
              Prism Health
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Your Health Assessment
            </h1>
            <div className="mt-4 max-w-xs mx-auto">
              <GoldRule />
            </div>
          </motion.div>

          {/* Assessment prose */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur ?? 0.6, delay: shouldReduceMotion ? 0 : 0.15 }}
            className="space-y-6"
          >
            {paragraphs.map((paragraph, i) => (
              <div key={i}>
                {i > 0 && i < paragraphs.length - 1 && (
                  <div className="flex justify-center mb-6">
                    <div className="w-1 h-1 rounded-full bg-[var(--quiz-gold)]/50" />
                  </div>
                )}
                <p
                  className={cn(
                    "text-[16px] sm:text-[17px] leading-[1.85] font-[450] text-foreground/85",
                    // Last paragraph (closing sentence) gets a distinct treatment
                    i === paragraphs.length - 1 && paragraphs.length > 1 &&
                      "text-[15px] sm:text-[16px] font-semibold text-foreground/90 mt-10 mb-4"
                  )}
                >
                  {paragraph}
                </p>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur ?? 0.5, delay: shouldReduceMotion ? 0 : 0.35 }}
          >
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEngagement(resultId, "booking_click")}
              className={cn(
                "flex items-center justify-center gap-3 w-full px-8 py-4 rounded-xl",
                "text-base font-semibold",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
                ACCENT.base,
                ACCENT.text
              )}
            >
              Take the Next Step With Prism
              <ArrowRight className="w-5 h-5" />
            </a>
            <p className="text-center text-sm text-muted-foreground mt-3">
              Start your root-cause health journey today
            </p>
          </motion.div>

        </div>
      </main>
    </div>
  );
}

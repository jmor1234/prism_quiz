"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";
import { Response } from "@/components/ai-elements/response";
import { ModeToggle } from "@/components/ui/mode-toggle";

// Placeholder — will be replaced with actual purchase page URL
const PURCHASE_URL = "/purchase";

function trackBookingClick(assessmentId: string) {
  fetch("/api/assessment/engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assessmentId, type: "booking_click" }),
    keepalive: true,
  }).catch(() => {});
}

export function AssessmentResult({
  report,
  resultId,
}: {
  report: string;
  resultId: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : undefined;

  return (
    <div className="min-h-screen quiz-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-end">
          <ModeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
        {/* Success banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl",
            "border border-[var(--quiz-gold)]/50 bg-[var(--quiz-gold)]/10"
          )}
        >
          <CheckCircle2 className="w-5 h-5 text-[var(--quiz-gold-dark)] shrink-0" />
          <p className="text-sm font-medium">
            Your personalized health assessment is ready
          </p>
        </motion.div>

        {/* Info about links */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...transition, delay: shouldReduceMotion ? 0 : 0.1 }}
          className="text-sm text-blue-600 dark:text-blue-400 text-center underline italic font-semibold"
        >
          Underlined text links to cited research sources and will open in a new
          tab.
        </motion.p>

        {/* Assessment report */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: shouldReduceMotion ? 0 : 0.15 }}
          className="rounded-lg border bg-card p-6 shadow-sm"
        >
          <Response variant="report">{report}</Response>
        </motion.div>

        {/* Purchase CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: shouldReduceMotion ? 0 : 0.3 }}
        >
          <a
            href={PURCHASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackBookingClick(resultId)}
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

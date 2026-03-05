"use client";

import { useCallback, useState } from "react";
import { Calendar, CheckCircle2, FileDown, MessageSquare } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildBookingUrl } from "@/lib/utmStorage";
import { trackEvent } from "@/lib/tracking";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import type { VariantConfig } from "@/lib/quiz/types";

export function QuizResult({
  result,
  variant,
}: {
  result: { id: string; report: string };
  variant: VariantConfig;
}) {
  const shouldReduceMotion = useReducedMotion();
  const staggerDelay = shouldReduceMotion ? 0 : 0.15;
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const downloadPdf = useCallback(async () => {
    trackEvent(result.id, "pdf_download", "assessment");
    setIsDownloadingPdf(true);
    try {
      const response = await fetch("/api/quiz/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: result.id }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: response.statusText }));
        throw new Error(
          errorData.error || `PDF generation failed: ${response.statusText}`
        );
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename =
        filenameMatch?.[1] ||
        `prism-assessment-${result.id.slice(0, 8)}.pdf`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Quiz PDF] Download error:", err);
      alert(
        `Failed to download PDF: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [result.id]);

  return (
    <div className="min-h-screen quiz-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-end">
          <ModeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Success banner */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: staggerDelay * 0 }}
            className="rounded-lg border border-[var(--quiz-gold)]/50 bg-[var(--quiz-gold)]/10 p-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--quiz-gold-dark)]" aria-hidden="true" />
              <p className="text-sm font-medium text-[var(--quiz-gold-dark)]">
                {variant.resultBanner}
              </p>
            </div>
          </motion.div>

          <p className="text-sm text-blue-600 dark:text-blue-400 text-center underline italic font-semibold">
            Underlined text links to cited research sources and will open in a new tab.
          </p>

          {/* Content area */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: staggerDelay * 1 }}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <Response variant="report">{result.report}</Response>
          </motion.div>

          {/* Action cards */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: staggerDelay * 2 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {/* Go Deeper on Your Results */}
              <a
                href={`/explore/${result.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(result.id, "agent_opened", "assessment")}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-5 text-center",
                  "border-[var(--quiz-gold)]/50 hover:border-[var(--quiz-gold)]",
                  "hover:bg-[var(--quiz-gold)]/10",
                  "transition-all duration-300 hover:-translate-y-0.5"
                )}
              >
                <MessageSquare className="h-5 w-5 text-[var(--quiz-gold-dark)]" aria-hidden="true" />
                <span className="text-base font-semibold">Go Deeper on Your Results</span>
                <span className="text-xs text-muted-foreground">
                  Ask questions and explore your patterns with real-time research
                </span>
              </a>

              {/* Talk to Our Team */}
              <a
                href={variant.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  trackEvent(result.id, "booking_click", "assessment");
                  const url = buildBookingUrl(variant.ctaUrl);
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-5 text-center",
                  "border-[var(--quiz-gold)]/50 hover:border-[var(--quiz-gold)]",
                  "hover:bg-[var(--quiz-gold)]/10",
                  "transition-all duration-300 hover:-translate-y-0.5"
                )}
              >
                <Calendar className="h-5 w-5 text-[var(--quiz-gold-dark)]" aria-hidden="true" />
                <span className="text-base font-semibold">Talk to Our Team</span>
                <span className="text-xs text-muted-foreground">
                  Free intro call to discuss your results and how we can help
                </span>
              </a>
            </div>

            {/* Save Your Assessment */}
            <div className="flex flex-col items-center gap-1">
              <Button
                variant="outline"
                onClick={downloadPdf}
                disabled={isDownloadingPdf}
                className="gap-2 transition-all duration-300 hover:-translate-y-0.5"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader className="h-4 w-4" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Save Your Assessment
                  </>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Download a PDF copy to reference or share
              </span>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

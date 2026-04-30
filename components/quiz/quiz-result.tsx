"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileDown, MessageCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildBookingUrl } from "@/lib/utmStorage";
import { trackEvent, trackBestlifeEvent } from "@/lib/tracking";
import { ACCENT } from "@/components/quiz/quiz-theme";
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

  // best-life-care uses fully separate engagement + PDF endpoints
  const isBestLife = variant.slug === "best-life-care";
  const trackQuizEvent = isBestLife ? trackBestlifeEvent : trackEvent;
  const pdfEndpoint = isBestLife ? "/api/bestlife/pdf" : "/api/quiz/pdf";

  // When a bookingTransition is set, the bridge paragraph and booking CTA
  // are absorbed into the assessment card so the closing thought and ask
  // read as part of the report rather than as a separate marketing block.
  const hasMergedCard = !!variant.bookingTransition;

  const bookingCta = (
    <div>
      <a
        href={variant.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          trackQuizEvent(result.id, "booking_click", "assessment");
          const url = buildBookingUrl(variant.ctaUrl);
          window.open(url, "_blank", "noopener,noreferrer");
        }}
        className={cn(
          "flex items-center justify-center gap-3 w-full px-8 py-4 rounded-xl",
          "text-base font-semibold",
          "transition-all duration-300 ease-out",
          "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
          ACCENT.base,
          ACCENT.text
        )}
      >
        Book a Free Call With Us
        <ArrowRight className="w-5 h-5" />
      </a>
      <p className="text-center text-sm text-muted-foreground mt-3">
        Free intro call to discuss your results and how we can help
      </p>
    </div>
  );

  const downloadPdf = useCallback(async () => {
    trackQuizEvent(result.id, "pdf_download", "assessment");
    setIsDownloadingPdf(true);

    // Open a new tab synchronously (within user gesture context) so mobile
    // browsers don't block it. We'll direct it to the PDF once generated.
    const pdfTab = window.open("", "_blank");

    try {
      const response = await fetch(pdfEndpoint, {
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
      const url = window.URL.createObjectURL(blob);

      if (pdfTab) {
        pdfTab.location.href = url;
      } else {
        // Fallback if popup was blocked: download in current tab
        const a = document.createElement("a");
        a.href = url;
        a.download = `prism-assessment-${result.id.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("[Quiz PDF] Download error:", err);
      // Close the blank tab if generation failed
      if (pdfTab) pdfTab.close();
      alert(
        `Failed to download PDF: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [result.id, trackQuizEvent, pdfEndpoint]);

  return (
    <div className="min-h-screen quiz-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
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

          {/* Assessment content — when a bookingTransition is set, the bridge
              paragraph and booking CTA are rendered inside the same card so
              the closing thought and ask flow visually with the report. */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: staggerDelay * 1 }}
            className="rounded-lg border bg-card p-6 shadow-sm"
          >
            <Response variant="report">{result.report}</Response>
            {hasMergedCard && (
              <div className="mt-10 pt-8 border-t border-border/40 space-y-6">
                <p className="text-base text-muted-foreground leading-relaxed text-center max-w-xl mx-auto">
                  {variant.bookingTransition}
                </p>
                {bookingCta}
              </div>
            )}
          </motion.div>

          {/* Standalone booking CTA — used when the variant has no bridge */}
          {!hasMergedCard && (
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: staggerDelay * 2 }}
            >
              {bookingCta}
            </motion.div>
          )}

          {/* Continue with chat agent — standard variants only (best-life-care has no chat handoff in v1) */}
          {!isBestLife && (
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: staggerDelay * (hasMergedCard ? 2 : 3) }}
              className="flex flex-col items-center gap-1"
            >
              <Button
                asChild
                variant="outline"
                className="gap-2 transition-all duration-300 hover:-translate-y-0.5"
              >
                <Link
                  href={`/explore/${result.id}`}
                  prefetch={false}
                  onClick={() => trackEvent(result.id, "agent_opened", "assessment")}
                >
                  <MessageCircle className="h-4 w-4" />
                  Continue Exploring with Our Health Agent
                </Link>
              </Button>
              <span className="text-xs text-muted-foreground">
                Continue the conversation with research-backed answers
              </span>
            </motion.div>
          )}

          {/* PDF download */}
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: staggerDelay * (hasMergedCard ? 3 : 4) }}
            className="flex flex-col items-center gap-1"
          >
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
          </motion.div>
        </div>
      </main>
    </div>
  );
}

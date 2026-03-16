"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCENT } from "@/components/quiz/quiz-theme";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { captureUTMParams } from "@/lib/utmStorage";

import { useAssessmentWizard } from "./use-assessment-wizard";
import { StepTransition } from "./step-transition";
import { IntroScreen } from "./intro-screen";
import { AssessmentStep, AssessmentStepSkeleton } from "./assessment-step";
import { AssessmentTransition } from "./assessment-transition";
import { AssessmentLoading } from "./assessment-loading";
import { AssessmentResult } from "./assessment-result";
import { NameCollectScreen } from "./name-collect-screen";

export function AssessmentClient() {
  const wizard = useAssessmentWizard();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    captureUTMParams();
  }, []);

  // Hydration guard
  if (!wizard.isHydrated) {
    return <div className="min-h-screen quiz-background" />;
  }

  // Full-screen states (no header/footer)
  if (wizard.phase === "generating") {
    return <AssessmentLoading />;
  }

  if (wizard.phase === "result" && wizard.result) {
    return <AssessmentResult report={wizard.result.report} resultId={wizard.result.id} />;
  }

  // Wizard states (with header/footer)
  const showProgress =
    wizard.phase === "goals" ||
    wizard.phase === "answering" ||
    wizard.phase === "loading_step" ||
    wizard.phase === "transition";
  const showBack =
    (wizard.phase === "goals" || wizard.phase === "answering") &&
    !wizard.passedTransition;
  const showNext =
    wizard.phase === "goals" || wizard.phase === "answering";

  return (
    <div className="min-h-screen quiz-background flex flex-col pt-[env(safe-area-inset-top)]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex-1">
            {showProgress && (
              <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs">
                <motion.div
                  className="h-full bg-[var(--quiz-gold)] rounded-full shadow-[0_0_8px_var(--quiz-gold)]/50"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(wizard.progressEstimate * 100, wizard.phase === "goals" ? 5 : 0)}%`,
                  }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "tween", duration: 0.3, ease: "easeOut" }
                  }
                />
              </div>
            )}
          </div>
          <ModeToggle />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 overflow-hidden">
        <StepTransition
          stepKey={
            wizard.phase === "intro"
              ? "intro"
              : wizard.phase === "transition"
              ? "transition"
              : wizard.phase === "name_collect"
              ? "name_collect"
              : wizard.stepIndex
          }
          direction={wizard.direction}
        >
          {wizard.phase === "intro" && (
            <IntroScreen onStart={wizard.start} />
          )}

          {wizard.phase === "loading_step" && <AssessmentStepSkeleton />}

          {(wizard.phase === "goals" || wizard.phase === "answering") && (
            <AssessmentStep
              question={wizard.currentQuestion}
              options={wizard.currentOptions}
              selectedOptions={wizard.selectedOptions}
              freeText={wizard.freeText}
              freeTextPlaceholder={wizard.currentPlaceholder}
              multiSelect={wizard.currentMultiSelect}
              onToggleOption={wizard.toggleOption}
              onFreeTextChange={wizard.setFreeText}
            />
          )}

          {wizard.phase === "transition" && wizard.transitionMessage && (
            <AssessmentTransition
              message={wizard.transitionMessage}
              onContinue={wizard.continueFromTransition}
              onSkip={wizard.skipFromTransition}
            />
          )}

          {wizard.phase === "name_collect" && (
            <NameCollectScreen
              name={wizard.name}
              onNameChange={wizard.setName}
              onGenerate={wizard.submitNameAndGenerate}
            />
          )}

          {wizard.phase === "error" && (
            <div className="space-y-6 text-center">
              <p className="text-lg font-medium text-foreground">
                Something went wrong
              </p>
              <p className="text-sm text-muted-foreground">{wizard.error}</p>
              <button
                type="button"
                onClick={wizard.retry}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 rounded-full",
                  "text-sm font-semibold",
                  "transition-all duration-300 ease-out",
                  "hover:-translate-y-0.5 hover:shadow-lg",
                  ACCENT.base,
                  ACCENT.text
                )}
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}
        </StepTransition>
      </div>

      {/* Footer */}
      {(showBack || showNext) && (
        <div className="sticky bottom-0 z-10 bg-background/95 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between px-4 py-3 max-w-md mx-auto">
            <div>
              {showBack && (
                <button
                  type="button"
                  onClick={wizard.back}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </div>

            <div>
              {showNext && (
                <button
                  type="button"
                  onClick={wizard.next}
                  disabled={!wizard.isValid}
                  className={cn(
                    "flex items-center gap-1.5 px-6 py-2.5 rounded-full",
                    "text-sm font-semibold",
                    "transition-all duration-300 ease-out",
                    "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none",
                    ACCENT.base,
                    ACCENT.text
                  )}
                >
                  Next
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

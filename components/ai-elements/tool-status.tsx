"use client";

import { Loader } from "./loader";
import { cn } from "@/lib/utils";

export type ToolStatusProps = {
  toolName: string;
  action: string;
  exiting?: boolean;
  variant?: "spinner" | "dots";
  className?: string;
};

const Dots = () => (
  <span className="inline-flex items-center gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 motion-safe:animate-bounce" />
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 motion-safe:animate-bounce animation-delay-100" />
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 motion-safe:animate-bounce animation-delay-200" />
  </span>
);

export const ToolStatus = ({
  action,
  exiting = false,
  variant = "spinner",
  className,
}: ToolStatusProps) => (
  <div
    className={cn("mx-auto w-full max-w-2xl px-4 md:px-6", className)}
    aria-live="polite"
  >
    <div
      className={cn(
        "not-prose mb-3 w-full rounded-xl border shadow-sm",
        "bg-gradient-to-b from-quiz-gold/[0.08] to-quiz-gold/[0.02] border-quiz-gold/20",
        "dark:from-quiz-gold/[0.10] dark:to-quiz-gold/[0.03] dark:border-quiz-gold/25",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2",
        exiting &&
          "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-top-2"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 text-sm motion-safe:animate-pulse",
          "text-quiz-gold-dark dark:text-quiz-gold",
          exiting && "opacity-70"
        )}
      >
        {variant === "spinner" ? (
          <Loader size={14} className="mr-1 text-quiz-gold-dark dark:text-quiz-gold" />
        ) : (
          <span className="mr-1 inline-flex w-4 justify-center" aria-hidden="true" />
        )}
        <span className="font-medium">
          {action}
          {variant === "dots" && <Dots />}
        </span>
      </div>
    </div>
  </div>
);

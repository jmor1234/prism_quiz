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
  <span className="ml-2 inline-flex items-center gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce"></span>
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce animation-delay-100"></span>
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce animation-delay-200"></span>
  </span>
);

const getToolLabel = (toolName: string): string => {
  const labels: Record<string, string> = {
    thinkTool: "Thinking",
    researchMemoryTool: "Recording notes",
    recommendDiagnosticsTool: "Selecting diagnostic tests",
    recommendDietLifestyleTool: "Selecting diet and lifestyle interventions",
    recommendSupplementsTool: "Selecting supplements",
  };
  return labels[toolName] || "Processing";
};

export const ToolStatus = ({ toolName, action, exiting = false, variant = "spinner", className }: ToolStatusProps) => {
  const label = getToolLabel(toolName);

  // Only announce when entering, not when exiting
  const liveRegion = !exiting ? "polite" : "off";

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[760px] px-4 md:px-6",
        className
      )}
    >
      <div
        role="status"
        aria-live={liveRegion}
        aria-atomic="true"
        className={cn(
          "not-prose mb-3 w-full rounded-xl border shadow-sm",
          "bg-gradient-to-b from-blue-500/[0.05] to-blue-500/[0.02] border-blue-500/20",
          "dark:from-violet-500/[0.08] dark:to-violet-500/[0.03] dark:border-violet-500/20",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2",
          exiting && "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-top-2"
        )}
      >
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 text-sm animate-pulse",
          "text-blue-700 dark:text-violet-400",
          exiting && "opacity-70"
        )}>
          {variant === "spinner" ? (
            <Loader size={14} className="mr-1 text-blue-600 dark:text-violet-400" aria-hidden="true" />
          ) : (
            <span className="mr-1 inline-flex w-4 justify-center" aria-hidden="true" />
          )}
          <span className="font-medium" aria-hidden="true">{label}</span>
          <span className="opacity-90">
            {action}
            {variant === "dots" && <Dots />}
          </span>
        </div>
      </div>
    </div>
  );
};



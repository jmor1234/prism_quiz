"use client";

import { Loader } from "./loader";
import { cn } from "@/lib/utils";

export type ToolStatusProps = {
  toolName: "thinkTool" | "researchMemoryTool";
  action: string;
  exiting?: boolean;
  variant?: "spinner" | "dots";
  className?: string;
};

const Dots = () => (
  <span className="ml-1 inline-flex items-center gap-1">
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce"></span>
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce animation-delay-100"></span>
    <span className="h-1.5 w-1.5 rounded-full bg-current/70 animate-bounce animation-delay-200"></span>
  </span>
);

export const ToolStatus = ({ toolName, action, exiting = false, variant = "spinner", className }: ToolStatusProps) => {
  const label = toolName === "thinkTool" ? "Thinking" : "Recording";
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[760px] px-4 md:px-6",
        className
      )}
    >
      <div
        className={cn(
          "not-prose mb-3 w-full rounded-xl border bg-gradient-to-b from-muted/30 to-muted/15 shadow-sm",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2",
          exiting && "motion-safe:animate-out motion-safe:fade-out-0 motion-safe:slide-out-to-top-2"
        )}
      >
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2.5 text-sm",
          exiting ? "text-muted-foreground/70" : "text-muted-foreground"
        )}>
          {variant === "spinner" ? (
            <Loader size={14} className="mr-1" />
          ) : (
            <span className="mr-1 inline-flex w-4 justify-center" aria-hidden="true" />
          )}
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground/80">
            {action}
            {variant === "dots" && <Dots />}
          </span>
        </div>
      </div>
    </div>
  );
};



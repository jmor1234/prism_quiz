"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export interface ReasoningProps {
  text: string;
  state?: "streaming" | "done";
  className?: string;
}

export const Reasoning = memo(({ text, state, className }: ReasoningProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasAutoClosed, setHasAutoClosed] = useState(false);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (state === "streaming") {
      startTimeRef.current = Date.now();
      const timer = setTimeout(() => setIsOpen(true), 0);
      return () => clearTimeout(timer);
    }
    if (state === "done" && startTimeRef.current !== null) {
      const elapsed = Math.ceil(
        (Date.now() - startTimeRef.current) / MS_IN_S
      );
      startTimeRef.current = null;
      const timer = setTimeout(() => setDuration(elapsed), 0);
      return () => clearTimeout(timer);
    }
  }, [state]);

  useEffect(() => {
    if (state === "done" && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [state, isOpen, hasAutoClosed]);

  const label =
    state === "streaming" || duration === 0
      ? "Thinking\u2026"
      : `Thought for ${duration} second${duration !== 1 ? "s" : ""}`;

  return (
    <Collapsible
      className={cn("not-prose mb-4", className)}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
        )}
      >
        <BrainIcon className="size-4" aria-hidden="true" />
        <p>{label}</p>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "size-4 transition-transform",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        className={cn(
          "mt-2 text-[10px]",
          "text-muted-foreground outline-none",
          "motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=open]:animate-in",
          "motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=closed]:slide-out-to-top-2",
          "motion-safe:data-[state=open]:slide-in-from-top-2"
        )}
      >
        <span className="whitespace-pre-wrap leading-snug">{text.replace(/\n{2,}/g, '\n')}</span>
      </CollapsibleContent>
    </Collapsible>
  );
});

Reasoning.displayName = "Reasoning";

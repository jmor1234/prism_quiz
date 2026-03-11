"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const springTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  opacity: { duration: 0.2 },
};

const noMotion = { duration: 0 };

export function StepTransition({
  stepKey,
  direction,
  children,
}: {
  stepKey: string | number;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const offset = direction === "forward" ? 80 : -80;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, x: offset, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -offset, scale: 0.95 }}
        transition={shouldReduceMotion ? noMotion : springTransition}
        className="w-full max-w-md"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

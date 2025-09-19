"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number; // final value
  duration?: number; // ms
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 500, format = (n) => Math.round(n).toString(), className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState<number>(value);
  const fromRef = useRef<number>(value);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current ?? 0;
    const to = value;
    if (from === to) return;
    startRef.current = null;

    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const elapsed = ts - (startRef.current || 0);
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}

export default AnimatedNumber;



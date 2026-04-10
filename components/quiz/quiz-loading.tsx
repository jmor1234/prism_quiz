"use client";

import { motion } from "framer-motion";

export function QuizLoading() {
  const ringSize = 120;
  const strokeWidth = 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        {/* Progress ring with pulsing dots */}
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          {/* Background ring */}
          <svg
            className="absolute inset-0 -rotate-90"
            width={ringSize}
            height={ringSize}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-muted"
            />
          </svg>

          {/* Animated progress ring */}
          <svg
            className="absolute inset-0 -rotate-90"
            width={ringSize}
            height={ringSize}
          >
            <defs>
              <linearGradient
                id="progressGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#C9A36A" />
                <stop offset="100%" stopColor="#B8935D" />
              </linearGradient>
            </defs>
            <motion.circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * 0.1 }}
              transition={{ duration: 40, ease: "easeInOut" }}
            />
          </svg>

          {/* Pulsing dots in center — CSS @keyframes (compositor thread) */}
          <div className="absolute inset-0 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[var(--quiz-gold)]"
                style={{
                  animation: "assessment-dot-pulse 1s ease-in-out infinite",
                  animationDelay: `${i * 200}ms`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Analyzing your responses
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Just a moment…</p>
        </motion.div>
      </motion.div>
    </div>
  );
}

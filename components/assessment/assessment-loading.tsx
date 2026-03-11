"use client";

import { motion } from "framer-motion";

export function AssessmentLoading() {
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
        <div className="relative" style={{ width: ringSize, height: ringSize }} aria-hidden="true">
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

          <svg
            className="absolute inset-0 -rotate-90"
            width={ringSize}
            height={ringSize}
          >
            <defs>
              <linearGradient
                id="assessmentProgressGradient"
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
              stroke="url(#assessmentProgressGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: circumference * 0.1 }}
              transition={{ duration: 60, ease: "easeInOut" }}
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[var(--quiz-gold)]"
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 text-center"
        >
          <p className="text-lg font-medium text-foreground">
            Generating your personalized assessment
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            This typically takes about a minute...
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

// lib/schemas/quiz.ts

import { z } from "zod";

// Night waking reasons
export const wakeReasons = ["no_reason", "eat", "drink", "pee"] as const;
export type WakeReason = (typeof wakeReasons)[number];

// Bowel issue types
export const bowelIssueTypes = [
  "straining",
  "pain",
  "incomplete",
  "diarrhea",
  "smell",
] as const;
export type BowelIssueType = (typeof bowelIssueTypes)[number];

export const quizSubmissionSchema = z.object({
  // Contact info
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional(),

  // Quiz answers
  energyLevel: z
    .number()
    .min(1, "Energy level must be at least 1")
    .max(10, "Energy level must be at most 10"),

  crashAfterLunch: z.boolean(),

  difficultyWaking: z.boolean(),

  wakeAtNight: z.object({
    wakes: z.boolean(),
    reasons: z.array(z.enum(wakeReasons)).optional(),
  }),

  brainFog: z.boolean(),

  bowelIssues: z.array(z.enum(bowelIssueTypes)),

  coldExtremities: z.boolean(),

  whiteTongue: z.boolean(),

  typicalEating: z
    .string()
    .min(1, "Please describe your typical eating habits"),

  healthGoals: z.string().min(1, "Please share your health goals"),
});

export type QuizSubmission = z.infer<typeof quizSubmissionSchema>;

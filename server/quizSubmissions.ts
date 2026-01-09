// server/quizSubmissions.ts

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

import type { QuizSubmission } from "@/lib/schemas/quiz";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "quiz-submissions");

// Redis client instance (lazy initialization)
let redisClient: Redis | null = null;

/**
 * Get Redis client if available, null otherwise
 */
function getRedisClient(): Redis | null {
  // Check if Redis is available via environment variable (separate database for quiz)
  if (process.env.UPSTASH_REDIS_REST_URL) {
    if (!redisClient) {
      redisClient = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
    }
    return redisClient;
  }
  return null;
}

/**
 * Get Redis key for a quiz submission
 */
function getSubmissionKey(id: string): string {
  return `quiz-submissions:${id}`;
}

/**
 * Get filesystem path for a submission file
 */
const submissionFilePath = (id: string) =>
  path.join(STORAGE_ROOT, `${id}.json`);

export interface QuizSubmissionRecord {
  id: string;
  createdAt: string;
  submission: QuizSubmission;
}

export async function upsertQuizSubmission({
  submission,
}: {
  submission: QuizSubmission;
}): Promise<QuizSubmissionRecord> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  const record: QuizSubmissionRecord = {
    id,
    createdAt: timestamp,
    submission,
  };

  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage (production)
    const key = getSubmissionKey(id);
    await redis.set(key, JSON.stringify(record));
  } else {
    // Use filesystem storage (local dev)
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.writeFile(
      submissionFilePath(id),
      JSON.stringify(record, null, 2),
      "utf8"
    );
  }

  return record;
}

export async function getQuizSubmission(
  id: string
): Promise<QuizSubmissionRecord | null> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage (production)
    try {
      const key = getSubmissionKey(id);
      const value = await redis.get(key);

      if (value === null) {
        return null;
      }

      // Upstash Redis may return string or already-parsed object
      if (typeof value === "string") {
        return JSON.parse(value) as QuizSubmissionRecord;
      }

      // Already an object (Upstash auto-deserializes JSON)
      return value as QuizSubmissionRecord;
    } catch (error) {
      // Redis errors should propagate
      throw error;
    }
  } else {
    // Use filesystem storage (local dev)
    try {
      const raw = await fs.readFile(submissionFilePath(id), "utf8");
      return JSON.parse(raw) as QuizSubmissionRecord;
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

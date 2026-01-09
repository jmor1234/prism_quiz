// server/quizResults.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "quiz-results");

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
 * Get Redis key for a quiz result
 */
function getResultKey(id: string): string {
  return `quiz-results:${id}`;
}

export interface QuizResult {
  id: string;
  createdAt: string;
  report: string;
}

export async function saveQuizResult({
  id,
  report,
}: {
  id: string;
  report: string;
}): Promise<QuizResult> {
  const timestamp = new Date().toISOString();

  const result: QuizResult = {
    id,
    createdAt: timestamp,
    report,
  };

  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage (production)
    const key = getResultKey(id);
    await redis.set(key, JSON.stringify(result));
  } else {
    // Use filesystem storage (local dev)
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const filePath = path.join(STORAGE_ROOT, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  }

  return result;
}

export async function getQuizResult(id: string): Promise<QuizResult | null> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage (production)
    try {
      const key = getResultKey(id);
      const value = await redis.get(key);

      if (value === null) {
        return null;
      }

      // Upstash Redis may return string or already-parsed object
      if (typeof value === "string") {
        return JSON.parse(value) as QuizResult;
      }

      // Already an object (Upstash auto-deserializes JSON)
      return value as QuizResult;
    } catch (error) {
      // Redis errors should propagate
      throw error;
    }
  } else {
    // Use filesystem storage (local dev)
    try {
      const filePath = path.join(STORAGE_ROOT, `${id}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as QuizResult;
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

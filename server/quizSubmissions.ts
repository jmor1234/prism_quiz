// server/quizSubmissions.ts

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

import type { QuizSubmission } from "@/lib/schemas/quiz";
import { getQuizResult } from "./quizResults";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "quiz-submissions");
const INDEX_KEY = "quiz-index";

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
    // Add to index sorted set (score = timestamp in ms for ordering)
    await redis.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
    // Use filesystem storage (local dev)
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.writeFile(
      submissionFilePath(id),
      JSON.stringify(record, null, 2),
      "utf8"
    );
    // Filesystem uses directory listing for index, no separate index needed
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

/**
 * Combined entry with submission and result
 */
export interface QuizEntry {
  id: string;
  createdAt: string;
  submission: QuizSubmission;
  report: string | null;
}

/**
 * List quiz entries (submission + result) sorted by newest first
 */
export async function listQuizEntries(limit: number = 100): Promise<QuizEntry[]> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis: get IDs from sorted set index (newest first)
    const ids = await redis.zrange(INDEX_KEY, 0, limit - 1, { rev: true });

    if (!ids || ids.length === 0) {
      return [];
    }

    // Fetch all submissions and results in parallel
    const entries = await Promise.all(
      ids.map(async (id) => {
        const idStr = String(id);
        const [submission, result] = await Promise.all([
          getQuizSubmission(idStr),
          getQuizResult(idStr),
        ]);

        if (!submission) {
          return null;
        }

        return {
          id: submission.id,
          createdAt: submission.createdAt,
          submission: submission.submission,
          report: result?.report ?? null,
        };
      })
    );

    // Filter out nulls (entries where submission wasn't found)
    return entries.filter((e): e is QuizEntry => e !== null);
  } else {
    // Use filesystem: read directory and sort by modification time
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      const files = await fs.readdir(STORAGE_ROOT);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      // Get file stats for sorting
      const filesWithStats = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(STORAGE_ROOT, file);
          const stat = await fs.stat(filePath);
          return { file, mtime: stat.mtime.getTime() };
        })
      );

      // Sort by modification time (newest first) and limit
      filesWithStats.sort((a, b) => b.mtime - a.mtime);
      const limitedFiles = filesWithStats.slice(0, limit);

      // Fetch submissions and results
      const entries = await Promise.all(
        limitedFiles.map(async ({ file }) => {
          const id = file.replace(".json", "");
          const [submission, result] = await Promise.all([
            getQuizSubmission(id),
            getQuizResult(id),
          ]);

          if (!submission) {
            return null;
          }

          return {
            id: submission.id,
            createdAt: submission.createdAt,
            submission: submission.submission,
            report: result?.report ?? null,
          };
        })
      );

      return entries.filter((e): e is QuizEntry => e !== null);
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }
}

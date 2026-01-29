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

export interface ListQuizEntriesResult {
  entries: QuizEntry[];
  nextCursor: string | null;
}

/**
 * List quiz entries (submission + result) sorted by newest first
 * @param limit - Max entries to return
 * @param cursor - ISO timestamp cursor; returns entries older than this
 */
export async function listQuizEntries(
  limit: number = 100,
  cursor?: string
): Promise<ListQuizEntriesResult> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis: get IDs from sorted set index (newest first)
    // With rev + byScore, args are (max, min) - we want scores from maxScore down to 0
    const maxScore = cursor ? new Date(cursor).getTime() - 1 : "+inf";
    const ids = await redis.zrange(INDEX_KEY, maxScore, 0, {
      rev: true,
      byScore: true,
      offset: 0,
      count: limit,
    });

    if (!ids || ids.length === 0) {
      return { entries: [], nextCursor: null };
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
    const validEntries = entries.filter((e): e is QuizEntry => e !== null);

    // nextCursor is the createdAt of the last entry (if we got a full page)
    const nextCursor =
      validEntries.length === limit
        ? validEntries[validEntries.length - 1].createdAt
        : null;

    return { entries: validEntries, nextCursor };
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

      // Filter by cursor if provided (entries older than cursor)
      const cursorTime = cursor ? new Date(cursor).getTime() : Infinity;
      const filtered = filesWithStats.filter((f) => f.mtime < cursorTime);

      // Sort by modification time (newest first) and limit
      filtered.sort((a, b) => b.mtime - a.mtime);
      const limitedFiles = filtered.slice(0, limit);

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

      const validEntries = entries.filter((e): e is QuizEntry => e !== null);

      // nextCursor is the createdAt of the last entry (if we got a full page)
      const nextCursor =
        validEntries.length === limit
          ? validEntries[validEntries.length - 1].createdAt
          : null;

      return { entries: validEntries, nextCursor };
    } catch (error) {
      if (isNotFoundError(error)) {
        return { entries: [], nextCursor: null };
      }
      throw error;
    }
  }
}

/**
 * Search quiz entries by name (case-insensitive substring match)
 * Searches ALL entries, no pagination
 * @param searchTerm - The name to search for
 * @param limit - Max entries to return (default 100)
 */
export async function searchQuizEntriesByName(
  searchTerm: string,
  limit: number = 100
): Promise<QuizEntry[]> {
  const searchLower = searchTerm.toLowerCase();
  const redis = getRedisClient();

  if (redis) {
    // Get all IDs from sorted set (newest first)
    const ids = await redis.zrange(INDEX_KEY, "+inf", 0, {
      rev: true,
      byScore: true,
    });

    if (!ids || ids.length === 0) {
      return [];
    }

    // Fetch and filter in batches to avoid memory issues
    const BATCH_SIZE = 50;
    const results: QuizEntry[] = [];

    for (let i = 0; i < ids.length && results.length < limit; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      const batchEntries = await Promise.all(
        batchIds.map(async (id) => {
          const idStr = String(id);
          const submission = await getQuizSubmission(idStr);

          if (!submission) return null;

          // Check if name matches
          if (!submission.submission.name.toLowerCase().includes(searchLower)) {
            return null;
          }

          const result = await getQuizResult(idStr);

          return {
            id: submission.id,
            createdAt: submission.createdAt,
            submission: submission.submission,
            report: result?.report ?? null,
          };
        })
      );

      // Add matching entries to results
      for (const entry of batchEntries) {
        if (entry && results.length < limit) {
          results.push(entry);
        }
      }
    }

    return results;
  } else {
    // Filesystem: read all submissions and filter
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      const files = await fs.readdir(STORAGE_ROOT);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      // Fetch all submissions
      const allSubmissions = await Promise.all(
        jsonFiles.map(async (file) => {
          const id = file.replace(".json", "");
          const submission = await getQuizSubmission(id);
          return submission;
        })
      );

      // Filter by name match and sort by createdAt descending
      const matching = allSubmissions
        .filter(
          (s): s is QuizSubmissionRecord =>
            s !== null && s.submission.name.toLowerCase().includes(searchLower)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit);

      // Fetch results for matching submissions
      const entries = await Promise.all(
        matching.map(async (submission) => {
          const result = await getQuizResult(submission.id);
          return {
            id: submission.id,
            createdAt: submission.createdAt,
            submission: submission.submission,
            report: result?.report ?? null,
          };
        })
      );

      return entries;
    } catch (error) {
      if (isNotFoundError(error)) {
        return [];
      }
      throw error;
    }
  }
}

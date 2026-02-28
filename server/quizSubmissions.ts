// server/quizSubmissions.ts

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

import type {
  QuizAnswers,
  QuizSubmissionRecord,
  QuizEntry,
  ListQuizEntriesResult,
} from "@/lib/quiz/types";
import { getQuizResult } from "./quizResults";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "quiz-submissions");
const INDEX_KEY = "quiz-index";

// Redis client instance (lazy initialization)
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
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

function getSubmissionKey(id: string): string {
  return `quiz-submissions:${id}`;
}

const submissionFilePath = (id: string) =>
  path.join(STORAGE_ROOT, `${id}.json`);

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return (
    "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
};

// ---------------------------------------------------------------------------
// Normalization: convert old record format to new format
// ---------------------------------------------------------------------------

/**
 * Normalize a raw storage record to the current QuizSubmissionRecord shape.
 *
 * Old format: { id, createdAt, submission: { name, energyLevel, wakeAtNight: { wakes, reasons }, ... } }
 * New format: { id, createdAt, variant, name, answers: { energyLevel, wakeAtNight: { answer, followUp }, ... } }
 */
function normalizeRecord(raw: Record<string, unknown>): QuizSubmissionRecord {
  // Already new format — has variant + name + answers at top level
  if (raw.variant && raw.answers && typeof raw.name === "string") {
    return raw as unknown as QuizSubmissionRecord;
  }

  // Old format — has { submission: QuizSubmission }
  const oldSubmission = raw.submission as Record<string, unknown> | undefined;
  if (!oldSubmission) {
    console.error("[Quiz] Unrecognized record format, missing both variant/answers and submission:", raw.id);
    throw new Error(`Unrecognized quiz submission record format: ${raw.id}`);
  }

  const { name, ...restFields } = oldSubmission;

  // Normalize wakeAtNight field names: { wakes, reasons } -> { answer, followUp }
  const answers: QuizAnswers = { ...restFields };
  const oldWake = restFields.wakeAtNight as
    | { wakes: boolean; reasons?: string[] }
    | undefined;
  if (oldWake && typeof oldWake === "object" && "wakes" in oldWake) {
    answers.wakeAtNight = {
      answer: oldWake.wakes,
      followUp: oldWake.reasons ?? [],
    };
  }

  return {
    id: raw.id as string,
    createdAt: raw.createdAt as string,
    variant: "root-cause",
    name: name as string,
    answers,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function upsertQuizSubmission({
  variant,
  name,
  answers,
}: {
  variant: string;
  name: string;
  answers: QuizAnswers;
}): Promise<QuizSubmissionRecord> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  const record: QuizSubmissionRecord = {
    id,
    createdAt: timestamp,
    variant,
    name,
    answers,
  };

  const redis = getRedisClient();

  if (redis) {
    const key = getSubmissionKey(id);
    await redis.set(key, JSON.stringify(record));
    await redis.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
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
    try {
      const key = getSubmissionKey(id);
      const value = await redis.get(key);

      if (value === null) return null;

      const raw =
        typeof value === "string"
          ? (JSON.parse(value) as Record<string, unknown>)
          : (value as Record<string, unknown>);

      return normalizeRecord(raw);
    } catch (error) {
      if (error instanceof SyntaxError) return null; // corrupted JSON
      throw error;
    }
  } else {
    try {
      const rawStr = await fs.readFile(submissionFilePath(id), "utf8");
      const raw = JSON.parse(rawStr) as Record<string, unknown>;
      return normalizeRecord(raw);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Listing & search
// ---------------------------------------------------------------------------

/**
 * Build a QuizEntry from a normalized submission record + optional result
 */
function toQuizEntry(
  record: QuizSubmissionRecord,
  report: string | null
): QuizEntry {
  return {
    id: record.id,
    createdAt: record.createdAt,
    variant: record.variant,
    name: record.name,
    answers: record.answers,
    report,
  };
}

export async function listQuizEntries(
  limit: number = 100,
  cursor?: string
): Promise<ListQuizEntriesResult> {
  const redis = getRedisClient();

  if (redis) {
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

    const entries = await Promise.all(
      ids.map(async (id) => {
        const idStr = String(id);
        const [submission, result] = await Promise.all([
          getQuizSubmission(idStr),
          getQuizResult(idStr),
        ]);
        if (!submission) return null;
        return toQuizEntry(submission, result?.report ?? null);
      })
    );

    const validEntries = entries.filter((e): e is QuizEntry => e !== null);
    const nextCursor =
      validEntries.length === limit
        ? validEntries[validEntries.length - 1].createdAt
        : null;

    return { entries: validEntries, nextCursor };
  } else {
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      const files = await fs.readdir(STORAGE_ROOT);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const filesWithStats = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(STORAGE_ROOT, file);
          const stat = await fs.stat(filePath);
          return { file, mtime: stat.mtime.getTime() };
        })
      );

      const cursorTime = cursor ? new Date(cursor).getTime() : Infinity;
      const filtered = filesWithStats.filter((f) => f.mtime < cursorTime);
      filtered.sort((a, b) => b.mtime - a.mtime);
      const limitedFiles = filtered.slice(0, limit);

      const entries = await Promise.all(
        limitedFiles.map(async ({ file }) => {
          const id = file.replace(".json", "");
          const [submission, result] = await Promise.all([
            getQuizSubmission(id),
            getQuizResult(id),
          ]);
          if (!submission) return null;
          return toQuizEntry(submission, result?.report ?? null);
        })
      );

      const validEntries = entries.filter((e): e is QuizEntry => e !== null);
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

export async function searchQuizEntriesByName(
  searchTerm: string,
  limit: number = 100
): Promise<QuizEntry[]> {
  const searchLower = searchTerm.toLowerCase();
  const redis = getRedisClient();

  if (redis) {
    const ids = await redis.zrange(INDEX_KEY, "+inf", 0, {
      rev: true,
      byScore: true,
    });

    if (!ids || ids.length === 0) return [];

    const BATCH_SIZE = 50;
    const results: QuizEntry[] = [];

    for (
      let i = 0;
      i < ids.length && results.length < limit;
      i += BATCH_SIZE
    ) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      const batchEntries = await Promise.all(
        batchIds.map(async (id) => {
          const idStr = String(id);
          const submission = await getQuizSubmission(idStr);
          if (!submission) return null;

          // Name is now top-level on the normalized record
          if (!submission.name.toLowerCase().includes(searchLower)) {
            return null;
          }

          const result = await getQuizResult(idStr);
          return toQuizEntry(submission, result?.report ?? null);
        })
      );

      for (const entry of batchEntries) {
        if (entry && results.length < limit) {
          results.push(entry);
        }
      }
    }

    return results;
  } else {
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      const files = await fs.readdir(STORAGE_ROOT);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const allSubmissions = await Promise.all(
        jsonFiles.map(async (file) => {
          const id = file.replace(".json", "");
          return getQuizSubmission(id);
        })
      );

      const matching = allSubmissions
        .filter(
          (s): s is QuizSubmissionRecord =>
            s !== null && s.name.toLowerCase().includes(searchLower)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit);

      const entries = await Promise.all(
        matching.map(async (submission) => {
          const result = await getQuizResult(submission.id);
          return toQuizEntry(submission, result?.report ?? null);
        })
      );

      return entries;
    } catch (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }
  }
}

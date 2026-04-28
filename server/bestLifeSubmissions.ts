// server/bestLifeSubmissions.ts
//
// Storage for the best-life-care quiz variant. Fully isolated from the
// standard quiz storage: separate Redis key prefix (bestlife-*) and separate
// filesystem directory. Reuses the same Redis env vars as the main quiz so
// no new infra provisioning is required.

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
import { getBestLifeResult } from "./bestLifeResults";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "bestlife-submissions");
const INDEX_KEY = "bestlife-index";
const VARIANT_SLUG = "best-life-care";

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
  return `bestlife-submissions:${id}`;
}

const submissionFilePath = (id: string) =>
  path.join(STORAGE_ROOT, `${id}.json`);

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function upsertBestLifeSubmission({
  name,
  answers,
}: {
  name: string;
  answers: QuizAnswers;
}): Promise<QuizSubmissionRecord> {
  const id = randomUUID();
  const timestamp = new Date().toISOString();

  const record: QuizSubmissionRecord = {
    id,
    createdAt: timestamp,
    variant: VARIANT_SLUG,
    name,
    answers,
  };

  const redis = getRedisClient();

  if (redis) {
    await redis.set(getSubmissionKey(id), JSON.stringify(record));
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

export async function getBestLifeSubmission(
  id: string
): Promise<QuizSubmissionRecord | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const value = await redis.get(getSubmissionKey(id));
      if (value === null) return null;
      const raw =
        typeof value === "string"
          ? (JSON.parse(value) as QuizSubmissionRecord)
          : (value as QuizSubmissionRecord);
      return raw;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  try {
    const rawStr = await fs.readFile(submissionFilePath(id), "utf8");
    return JSON.parse(rawStr) as QuizSubmissionRecord;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Listing & search
// ---------------------------------------------------------------------------

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

export async function listBestLifeEntries(
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
          getBestLifeSubmission(idStr),
          getBestLifeResult(idStr),
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
  }

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
    const cursorFiltered = filesWithStats.filter((f) => f.mtime < cursorTime);
    cursorFiltered.sort((a, b) => b.mtime - a.mtime);
    const limited = cursorFiltered.slice(0, limit);

    const entries = await Promise.all(
      limited.map(async ({ file }) => {
        const id = file.replace(".json", "");
        const [submission, result] = await Promise.all([
          getBestLifeSubmission(id),
          getBestLifeResult(id),
        ]);
        if (!submission) return null;
        return toQuizEntry(submission, result?.report ?? null);
      })
    );

    const validEntries = entries.filter((e): e is QuizEntry => e !== null);
    const nextCursor =
      validEntries.length === limit && cursorFiltered.length > limit
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

export async function searchBestLifeEntriesByName(
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

    for (let i = 0; i < ids.length && results.length < limit; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);

      const batchEntries = await Promise.all(
        batchIds.map(async (id) => {
          const idStr = String(id);
          const submission = await getBestLifeSubmission(idStr);
          if (!submission) return null;
          if (!submission.name.toLowerCase().includes(searchLower)) return null;
          const result = await getBestLifeResult(idStr);
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
  }

  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const files = await fs.readdir(STORAGE_ROOT);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const allSubmissions = await Promise.all(
      jsonFiles.map(async (file) => {
        const id = file.replace(".json", "");
        return getBestLifeSubmission(id);
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
        const result = await getBestLifeResult(submission.id);
        return toQuizEntry(submission, result?.report ?? null);
      })
    );

    return entries;
  } catch (error) {
    if (isNotFoundError(error)) return [];
    throw error;
  }
}

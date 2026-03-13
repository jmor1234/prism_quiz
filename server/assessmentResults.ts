// server/assessmentResults.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { IntakeStep } from "@/app/api/assessment/types";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "assessment-results");
const INDEX_KEY = "assessment-index";

// Separate Redis instance for assessment data
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_ASSESSMENT_REDIS_REST_URL;
  const token = process.env.UPSTASH_ASSESSMENT_REDIS_REST_TOKEN;
  if (url) {
    if (!token) {
      throw new Error(
        "UPSTASH_ASSESSMENT_REDIS_REST_TOKEN must be set when UPSTASH_ASSESSMENT_REDIS_REST_URL is set"
      );
    }
    if (!redisClient) {
      redisClient = new Redis({ url, token });
    }
    return redisClient;
  }
  return null;
}

function getResultKey(id: string): string {
  return `assessment-results:${id}`;
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

// --- Types ---

export interface AssessmentResult {
  id: string;
  createdAt: string;
  name: string;
  steps: IntakeStep[];
  report: string;
}

// --- Normalization (backwards compat) ---

function normalizeRecord(raw: Record<string, unknown>): AssessmentResult {
  return {
    id: raw.id as string,
    createdAt: (raw.createdAt as string) ?? new Date().toISOString(),
    name: (raw.name as string) ?? "",
    steps: (raw.steps as IntakeStep[]) ?? [],
    report: (raw.report as string) ?? "",
  };
}

// --- CRUD ---

export async function saveAssessmentResult({
  id,
  name,
  steps,
  report,
}: {
  id: string;
  name: string;
  steps: IntakeStep[];
  report: string;
}): Promise<AssessmentResult> {
  const timestamp = new Date().toISOString();

  const result: AssessmentResult = {
    id,
    createdAt: timestamp,
    name,
    steps,
    report,
  };

  const redis = getRedisClient();

  if (redis) {
    const key = getResultKey(id);
    await redis.set(key, JSON.stringify(result));
    await redis.zadd(INDEX_KEY, { score: Date.now(), member: id });
  } else {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const filePath = path.join(STORAGE_ROOT, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  }

  return result;
}

export async function getAssessmentResult(
  id: string
): Promise<AssessmentResult | null> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = getResultKey(id);
      const value = await redis.get(key);
      if (value === null) return null;

      const raw =
        typeof value === "string"
          ? (JSON.parse(value) as Record<string, unknown>)
          : (value as Record<string, unknown>);

      return normalizeRecord(raw);
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  } else {
    try {
      const filePath = path.join(STORAGE_ROOT, `${id}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      return normalizeRecord(JSON.parse(raw) as Record<string, unknown>);
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }
}

// --- Listing & search ---

export interface ListAssessmentResultsResponse {
  entries: AssessmentResult[];
  nextCursor: string | null;
}

export async function listAssessmentResults(
  limit: number = 50,
  cursor?: string
): Promise<ListAssessmentResultsResponse> {
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
      ids.map(async (id) => getAssessmentResult(String(id)))
    );

    const valid = entries.filter((e): e is AssessmentResult => e !== null);
    const nextCursor =
      valid.length === limit ? valid[valid.length - 1].createdAt : null;

    return { entries: valid, nextCursor };
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

      const limited = filtered.slice(0, limit);
      const entries = await Promise.all(
        limited.map(async ({ file }) => {
          const id = file.replace(".json", "");
          return getAssessmentResult(id);
        })
      );

      const valid = entries.filter((e): e is AssessmentResult => e !== null);
      const nextCursor =
        valid.length === limit && filtered.length > limit
          ? valid[valid.length - 1].createdAt
          : null;

      return { entries: valid, nextCursor };
    } catch (error) {
      if (isNotFoundError(error)) {
        return { entries: [], nextCursor: null };
      }
      throw error;
    }
  }
}

export async function searchAssessmentResults(
  searchTerm: string,
  limit: number = 50
): Promise<AssessmentResult[]> {
  const searchLower = searchTerm.toLowerCase();
  const redis = getRedisClient();

  if (redis) {
    const ids = await redis.zrange(INDEX_KEY, "+inf", 0, {
      rev: true,
      byScore: true,
    });

    if (!ids || ids.length === 0) return [];

    const BATCH_SIZE = 50;
    const results: AssessmentResult[] = [];

    for (let i = 0; i < ids.length && results.length < limit; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const records = await Promise.all(
        batch.map(async (id) => getAssessmentResult(String(id)))
      );

      for (const record of records) {
        if (
          record &&
          record.name.toLowerCase().includes(searchLower) &&
          results.length < limit
        ) {
          results.push(record);
        }
      }
    }

    return results;
  } else {
    try {
      await fs.mkdir(STORAGE_ROOT, { recursive: true });
      const files = await fs.readdir(STORAGE_ROOT);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const all = await Promise.all(
        jsonFiles.map(async (file) => {
          const id = file.replace(".json", "");
          return getAssessmentResult(id);
        })
      );

      return all
        .filter(
          (r): r is AssessmentResult =>
            r !== null && r.name.toLowerCase().includes(searchLower)
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit);
    } catch (error) {
      if (isNotFoundError(error)) return [];
      throw error;
    }
  }
}

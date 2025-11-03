// server/phase1Cases.ts

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

import type { Phase1Submission } from "@/lib/schemas/phase1";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "phase1-submissions");
const CASE_FILE_EXTENSION = ".json";

// Redis client instance (lazy initialization)
let redisClient: Redis | null = null;

/**
 * Get Redis client if available, null otherwise
 */
function getRedisClient(): Redis | null {
  // Check if Redis is available via environment variable
  if (process.env.UPSTASH_REDIS_REST_URL) {
    if (!redisClient) {
      redisClient = Redis.fromEnv();
    }
    return redisClient;
  }
  return null;
}

/**
 * Get Redis key for a case submission
 */
function getSubmissionKey(caseId: string): string {
  return `phase1-submissions:${caseId}`;
}

/**
 * Get filesystem path for a case file
 */
const caseFilePath = (caseId: string) =>
  path.join(STORAGE_ROOT, `${caseId}${CASE_FILE_EXTENSION}`);

export interface Phase1CaseRecord {
  caseId: string;
  createdAt: string;
  updatedAt: string;
  submission: Phase1Submission;
}

export async function upsertPhase1Case({
  submission,
}: {
  submission: Phase1Submission;
}): Promise<Phase1CaseRecord> {
  const caseId = randomUUID();
  const timestamp = new Date().toISOString();

  const record: Phase1CaseRecord = {
    caseId,
    createdAt: timestamp,
    updatedAt: timestamp,
    submission,
  };

  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage
    const key = getSubmissionKey(caseId);
    await redis.set(key, JSON.stringify(record));
  } else {
    // Use filesystem storage (local dev)
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    await fs.writeFile(caseFilePath(caseId), JSON.stringify(record, null, 2), "utf8");
  }

  return record;
}

export async function getPhase1Case(caseId: string): Promise<Phase1CaseRecord | null> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage
    try {
      const key = getSubmissionKey(caseId);
      const value = await redis.get<string>(key);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value) as Phase1CaseRecord;
    } catch (error) {
      // Redis errors should propagate
      throw error;
    }
  } else {
    // Use filesystem storage (local dev)
    try {
      const raw = await fs.readFile(caseFilePath(caseId), "utf8");
      const parsed = JSON.parse(raw) as Phase1CaseRecord;
      return parsed;
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


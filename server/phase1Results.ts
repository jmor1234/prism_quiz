// server/phase1Results.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "phase1-results");

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
 * Get Redis key for a case result
 */
function getResultKey(caseId: string): string {
  return `phase1-results:${caseId}`;
}

export interface Phase1Result {
  caseId: string;
  createdAt: string;
  report: string;
  version?: number;
}

export async function savePhase1Result({
  caseId,
  report,
}: {
  caseId: string;
  report: string;
}): Promise<Phase1Result> {
  const timestamp = new Date().toISOString();

  const result: Phase1Result = {
    caseId,
    createdAt: timestamp,
    report,
    version: 1,
  };

  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage
    const key = getResultKey(caseId);
    await redis.set(key, JSON.stringify(result));
  } else {
    // Use filesystem storage (local dev)
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const filePath = path.join(STORAGE_ROOT, `${caseId}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  }

  return result;
}

export async function getPhase1Result(
  caseId: string,
): Promise<Phase1Result | null> {
  const redis = getRedisClient();

  if (redis) {
    // Use Redis storage
    try {
      const key = getResultKey(caseId);
      const value = await redis.get(key);
      
      if (value === null) {
        return null;
      }

      // Upstash Redis may return string or already-parsed object
      if (typeof value === 'string') {
        return JSON.parse(value) as Phase1Result;
      }
      
      // Already an object (Upstash auto-deserializes JSON)
      return value as Phase1Result;
    } catch (error) {
      // Redis errors should propagate
      throw error;
    }
  } else {
    // Use filesystem storage (local dev)
    try {
      const filePath = path.join(STORAGE_ROOT, `${caseId}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as Phase1Result;
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

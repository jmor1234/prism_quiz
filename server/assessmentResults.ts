// server/assessmentResults.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "assessment-results");

// Separate Redis instance for assessment data
// Requires its own UPSTASH_ASSESSMENT_REDIS_REST_URL and UPSTASH_ASSESSMENT_REDIS_REST_TOKEN
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

export interface AssessmentResult {
  id: string;
  createdAt: string;
  report: string;
}

export async function saveAssessmentResult({
  id,
  report,
}: {
  id: string;
  report: string;
}): Promise<AssessmentResult> {
  const timestamp = new Date().toISOString();

  const result: AssessmentResult = {
    id,
    createdAt: timestamp,
    report,
  };

  const redis = getRedisClient();

  if (redis) {
    const key = getResultKey(id);
    await redis.set(key, JSON.stringify(result));
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

      if (value === null) {
        return null;
      }

      if (typeof value === "string") {
        return JSON.parse(value) as AssessmentResult;
      }

      return value as AssessmentResult;
    } catch (error) {
      throw error;
    }
  } else {
    try {
      const filePath = path.join(STORAGE_ROOT, `${id}.json`);
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as AssessmentResult;
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

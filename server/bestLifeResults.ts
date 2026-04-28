// server/bestLifeResults.ts
//
// Result storage for the best-life-care quiz variant. Uses bestlife-results:*
// keys (Redis) and storage/bestlife-results/ (filesystem fallback) for full
// isolation from the standard quiz results namespace.

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "bestlife-results");

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

function getResultKey(id: string): string {
  return `bestlife-results:${id}`;
}

export interface BestLifeResult {
  id: string;
  createdAt: string;
  report: string;
}

export async function saveBestLifeResult({
  id,
  report,
}: {
  id: string;
  report: string;
}): Promise<BestLifeResult> {
  const result: BestLifeResult = {
    id,
    createdAt: new Date().toISOString(),
    report,
  };

  const redis = getRedisClient();

  if (redis) {
    await redis.set(getResultKey(id), JSON.stringify(result));
  } else {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const filePath = path.join(STORAGE_ROOT, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");
  }

  return result;
}

export async function getBestLifeResult(
  id: string
): Promise<BestLifeResult | null> {
  const redis = getRedisClient();

  if (redis) {
    const value = await redis.get(getResultKey(id));
    if (value === null) return null;
    if (typeof value === "string") return JSON.parse(value) as BestLifeResult;
    return value as BestLifeResult;
  }

  try {
    const filePath = path.join(STORAGE_ROOT, `${id}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as BestLifeResult;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

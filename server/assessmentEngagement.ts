// server/assessmentEngagement.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(
  process.cwd(),
  "storage",
  "assessment-engagement"
);

// Uses the same separate Redis instance as assessment results
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

function getKey(id: string): string {
  return `assessment-engagement:${id}`;
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

// --- Types ---

export interface AssessmentEngagementEvent {
  type: string;
  timestamp: string;
}

export interface AssessmentEngagement {
  assessmentId: string;
  events: AssessmentEngagementEvent[];
  updatedAt: string;
}

const VALID_EVENT_TYPES = new Set(["booking_click", "pdf_download"]);
const DEDUP_WINDOW_MS = 5_000;

// --- Internal helpers ---

async function readRecord(
  id: string
): Promise<AssessmentEngagement | null> {
  const redis = getRedisClient();

  if (redis) {
    const value = await redis.get(getKey(id));
    if (value === null) return null;
    if (typeof value === "string")
      return JSON.parse(value) as AssessmentEngagement;
    return value as AssessmentEngagement;
  }

  try {
    const filePath = path.join(STORAGE_ROOT, `${id}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as AssessmentEngagement;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function writeRecord(record: AssessmentEngagement): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    await redis.set(getKey(record.assessmentId), JSON.stringify(record));
    return;
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, `${record.assessmentId}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

// --- Public API ---

export async function trackAssessmentEvent(
  assessmentId: string,
  type: string
): Promise<void> {
  if (!VALID_EVENT_TYPES.has(type)) return;

  const record = (await readRecord(assessmentId)) ?? {
    assessmentId,
    events: [],
    updatedAt: new Date().toISOString(),
  };

  const now = new Date();

  // Dedup within 5s window
  const isDuplicate = record.events.some(
    (e) =>
      e.type === type &&
      now.getTime() - new Date(e.timestamp).getTime() < DEDUP_WINDOW_MS
  );

  if (isDuplicate) return;

  record.events.push({ type, timestamp: now.toISOString() });
  record.updatedAt = now.toISOString();

  await writeRecord(record);
}

export async function getAssessmentEngagement(
  id: string
): Promise<AssessmentEngagement | null> {
  return readRecord(id);
}

export async function getAssessmentEngagementBatch(
  ids: string[]
): Promise<Map<string, AssessmentEngagement>> {
  const results = new Map<string, AssessmentEngagement>();
  const records = await Promise.all(ids.map((id) => readRecord(id)));

  for (let i = 0; i < ids.length; i++) {
    const record = records[i];
    if (record) {
      results.set(ids[i], record);
    }
  }

  return results;
}

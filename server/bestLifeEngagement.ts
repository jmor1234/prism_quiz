// server/bestLifeEngagement.ts
//
// Engagement storage for the best-life-care quiz variant. Mirrors the
// standard quizEngagement module with bestlife-engagement:* keys and
// storage/bestlife-engagement/ filesystem fallback.

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "bestlife-engagement");

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

function getEngagementKey(id: string): string {
  return `bestlife-engagement:${id}`;
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

// --- Types ---

export interface EngagementEvent {
  type: "pdf_download" | "booking_click" | "agent_opened";
  source: "assessment" | "agent";
  timestamp: string;
}

export interface SerializedMessage {
  role: "user" | "assistant";
  text: string;
}

export interface EngagementRecord {
  quizId: string;
  events: EngagementEvent[];
  conversation: SerializedMessage[] | null;
  summary: string | null;
  updatedAt: string;
}

const VALID_EVENT_TYPES = new Set(["pdf_download", "booking_click", "agent_opened"]);
const VALID_SOURCES = new Set(["assessment", "agent"]);
const DEDUP_WINDOW_MS = 5_000;

function createEmptyRecord(quizId: string): EngagementRecord {
  return {
    quizId,
    events: [],
    conversation: null,
    summary: null,
    updatedAt: new Date().toISOString(),
  };
}

async function readRecord(quizId: string): Promise<EngagementRecord | null> {
  const redis = getRedisClient();

  if (redis) {
    const value = await redis.get(getEngagementKey(quizId));
    if (value === null) return null;
    if (typeof value === "string") return JSON.parse(value) as EngagementRecord;
    return value as EngagementRecord;
  }

  try {
    const filePath = path.join(STORAGE_ROOT, `${quizId}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as EngagementRecord;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function writeRecord(record: EngagementRecord): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    await redis.set(getEngagementKey(record.quizId), JSON.stringify(record));
    return;
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, `${record.quizId}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
}

export async function appendBestLifeEvent(
  quizId: string,
  event: { type: string; source: string }
): Promise<void> {
  if (!VALID_EVENT_TYPES.has(event.type) || !VALID_SOURCES.has(event.source)) {
    return;
  }

  const record = (await readRecord(quizId)) ?? createEmptyRecord(quizId);
  const now = new Date();

  const isDuplicate = record.events.some(
    (e) =>
      e.type === event.type &&
      e.source === event.source &&
      now.getTime() - new Date(e.timestamp).getTime() < DEDUP_WINDOW_MS
  );

  if (isDuplicate) return;

  record.events.push({
    type: event.type as EngagementEvent["type"],
    source: event.source as EngagementEvent["source"],
    timestamp: now.toISOString(),
  });
  record.updatedAt = now.toISOString();

  await writeRecord(record);
}

export async function saveBestLifeConversation(
  quizId: string,
  messages: SerializedMessage[]
): Promise<void> {
  const record = (await readRecord(quizId)) ?? createEmptyRecord(quizId);
  record.conversation = messages;
  record.updatedAt = new Date().toISOString();
  await writeRecord(record);
}

export async function saveBestLifeSummary(
  quizId: string,
  summary: string
): Promise<void> {
  const record = (await readRecord(quizId)) ?? createEmptyRecord(quizId);
  record.summary = summary;
  record.updatedAt = new Date().toISOString();
  await writeRecord(record);
}

export async function getBestLifeEngagement(
  quizId: string
): Promise<EngagementRecord | null> {
  return readRecord(quizId);
}

export async function getBestLifeEngagementBatch(
  quizIds: string[]
): Promise<Map<string, EngagementRecord>> {
  const results = new Map<string, EngagementRecord>();
  const records = await Promise.all(quizIds.map((id) => readRecord(id)));

  for (let i = 0; i < quizIds.length; i++) {
    const record = records[i];
    if (record) {
      results.set(quizIds[i], record);
    }
  }

  return results;
}

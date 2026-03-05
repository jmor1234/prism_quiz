// server/chatSessions.ts

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "chat-sessions");

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

function getSessionKey(id: string): string {
  return `chat-sessions:${id}`;
}

const INDEX_KEY = "chat-sessions-index";

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") return false;
  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

// --- Types ---

export interface SerializedMessage {
  role: "user" | "assistant";
  text: string;
}

export interface ChatEvent {
  type: "booking_click";
  source: "chat";
  timestamp: string;
}

export interface ChatSession {
  threadId: string;
  conversation: SerializedMessage[] | null;
  summary: string | null;
  events: ChatEvent[];
  createdAt: string;
  updatedAt: string;
}

const VALID_EVENT_TYPES = new Set(["booking_click"]);
const VALID_SOURCES = new Set(["chat"]);
const DEDUP_WINDOW_MS = 5_000;

function createEmptySession(threadId: string): ChatSession {
  const now = new Date().toISOString();
  return {
    threadId,
    conversation: null,
    summary: null,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

// --- Internal read/write helpers ---

async function readSession(threadId: string): Promise<ChatSession | null> {
  const redis = getRedisClient();

  if (redis) {
    const value = await redis.get(getSessionKey(threadId));
    if (value === null) return null;
    if (typeof value === "string") return JSON.parse(value) as ChatSession;
    return value as ChatSession;
  }

  try {
    const filePath = path.join(STORAGE_ROOT, `${threadId}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as ChatSession;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function writeSession(session: ChatSession): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    await redis.set(getSessionKey(session.threadId), JSON.stringify(session));
    // Add to sorted set index for listing
    await redis.zadd(INDEX_KEY, {
      score: Date.now(),
      member: session.threadId,
    });
    return;
  }

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, `${session.threadId}.json`);
  await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf8");
}

// --- Public API ---

export async function saveChatConversation(
  threadId: string,
  messages: SerializedMessage[]
): Promise<void> {
  const session = (await readSession(threadId)) ?? createEmptySession(threadId);
  session.conversation = messages;
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
}

export async function appendChatEvent(
  threadId: string,
  event: { type: string; source: string }
): Promise<void> {
  if (!VALID_EVENT_TYPES.has(event.type) || !VALID_SOURCES.has(event.source)) {
    return; // silently ignore invalid events
  }

  const session = (await readSession(threadId)) ?? createEmptySession(threadId);
  const now = new Date();

  // Dedup: skip if same type+source within last 5 seconds
  const isDuplicate = session.events.some(
    (e) =>
      e.type === event.type &&
      e.source === event.source &&
      now.getTime() - new Date(e.timestamp).getTime() < DEDUP_WINDOW_MS
  );
  if (isDuplicate) return;

  session.events.push({
    type: event.type as ChatEvent["type"],
    source: event.source as ChatEvent["source"],
    timestamp: now.toISOString(),
  });
  session.updatedAt = now.toISOString();
  await writeSession(session);
}

export async function saveChatSummary(
  threadId: string,
  summary: string
): Promise<void> {
  const session = (await readSession(threadId)) ?? createEmptySession(threadId);
  session.summary = summary;
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
}

export async function getChatSession(
  threadId: string
): Promise<ChatSession | null> {
  return readSession(threadId);
}

export async function listChatSessions(
  limit: number = 100,
  cursor?: string
): Promise<{ sessions: ChatSession[]; nextCursor: string | null }> {
  const redis = getRedisClient();

  if (redis) {
    // Score-based cursor pagination (same pattern as quizSubmissions)
    // Cursor is an ISO timestamp; scores are Date.now() milliseconds
    const maxScore = cursor ? new Date(cursor).getTime() - 1 : "+inf";
    const ids = await redis.zrange(INDEX_KEY, maxScore, 0, {
      rev: true,
      byScore: true,
      offset: 0,
      count: limit,
    });

    if (!ids || ids.length === 0) {
      return { sessions: [], nextCursor: null };
    }

    const sessions = (
      await Promise.all(ids.map((id) => readSession(String(id))))
    ).filter((s): s is ChatSession => s !== null);

    // Next cursor is the updatedAt of the last session returned
    const nextCursor =
      sessions.length === limit
        ? sessions[sessions.length - 1].updatedAt
        : null;
    return { sessions, nextCursor };
  }

  // Filesystem: list all files, sort by updatedAt descending
  try {
    await fs.mkdir(STORAGE_ROOT, { recursive: true });
    const files = await fs.readdir(STORAGE_ROOT);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const allSessions = (
      await Promise.all(
        jsonFiles.map(async (f) => {
          try {
            const raw = await fs.readFile(path.join(STORAGE_ROOT, f), "utf8");
            return JSON.parse(raw) as ChatSession;
          } catch {
            return null;
          }
        })
      )
    )
      .filter((s): s is ChatSession => s !== null)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Cursor-based pagination using updatedAt timestamp
    let startIdx = 0;
    if (cursor) {
      const cursorTime = new Date(cursor).getTime();
      startIdx = allSessions.findIndex(
        (s) => new Date(s.updatedAt).getTime() < cursorTime
      );
      if (startIdx === -1) startIdx = allSessions.length;
    }

    const page = allSessions.slice(startIdx, startIdx + limit);
    const nextCursor =
      startIdx + limit < allSessions.length
        ? page[page.length - 1]?.updatedAt ?? null
        : null;

    return { sessions: page, nextCursor };
  } catch {
    return { sessions: [], nextCursor: null };
  }
}

export async function getChatSessionBatch(
  threadIds: string[]
): Promise<Map<string, ChatSession>> {
  const results = new Map<string, ChatSession>();
  const records = await Promise.all(threadIds.map((id) => readSession(id)));

  for (let i = 0; i < threadIds.length; i++) {
    const record = records[i];
    if (record) {
      results.set(threadIds[i], record);
    }
  }

  return results;
}

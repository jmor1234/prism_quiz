// lib/chat/thread-store.ts

import Dexie from "dexie";
import { nanoid } from "nanoid";
import type { UIMessage } from "ai";

export interface ThreadMeta {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

interface ThreadMessages {
  threadId: string;
  messages: UIMessage[];
}

interface ChatDB extends Dexie {
  threads: Dexie.Table<ThreadMeta, string>;
  messages: Dexie.Table<ThreadMessages, string>;
}

let db: ChatDB | null = null;

function getDb(): ChatDB {
  if (!db) {
    db = new Dexie("prism-chat") as ChatDB;
    db.version(1).stores({
      threads: "id",
      messages: "threadId",
    });
  }
  return db;
}

export async function createThread(): Promise<string> {
  if (typeof window === "undefined") return "";
  const id = `thr_${nanoid(12)}`;
  const now = Date.now();
  const d = getDb();
  await d.transaction("rw", d.threads, d.messages, async () => {
    await d.threads.put({
      id,
      title: "New conversation",
      preview: "",
      createdAt: now,
      updatedAt: now,
    });
    await d.messages.put({ threadId: id, messages: [] });
  });
  return id;
}

export async function listThreads(): Promise<ThreadMeta[]> {
  if (typeof window === "undefined") return [];
  const threads = await getDb().threads.toArray();
  return threads.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getLatestThread(): Promise<ThreadMeta | null> {
  if (typeof window === "undefined") return null;
  const threads = await listThreads();
  return threads[0] ?? null;
}

export async function saveMessages(
  threadId: string,
  messages: UIMessage[]
): Promise<void> {
  if (typeof window === "undefined") return;
  const d = getDb();

  // Derive title from first user message, preview from last assistant (single pass)
  let title: string | undefined;
  let preview = "";

  for (const m of messages) {
    const text = m.parts
      .reduce(
        (acc, p) =>
          p.type === "text"
            ? acc + (acc ? " " : "") + (p as { type: "text"; text: string }).text
            : acc,
        ""
      )
      .trim();
    if (!text) continue;
    if (!title && m.role === "user") title = text.slice(0, 80);
    if (m.role === "assistant") preview = text.slice(0, 120);
  }

  await d.transaction("rw", d.threads, d.messages, async () => {
    const existing = await d.threads.get(threadId);
    if (existing) {
      await d.threads.update(threadId, {
        ...(title ? { title } : {}),
        preview,
        updatedAt: Date.now(),
      });
    }
    await d.messages.put({ threadId, messages });
  });
}

export async function loadMessages(threadId: string): Promise<UIMessage[]> {
  if (typeof window === "undefined") return [];
  const record = await getDb().messages.get(threadId);
  return record?.messages ?? [];
}

export async function renameThread(
  id: string,
  title: string
): Promise<void> {
  if (typeof window === "undefined") return;
  await getDb().threads.update(id, { title });
}

export async function deleteThread(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  const d = getDb();
  await d.transaction("rw", d.threads, d.messages, async () => {
    await d.threads.delete(id);
    await d.messages.delete(id);
  });
}

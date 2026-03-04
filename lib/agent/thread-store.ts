// lib/agent/thread-store.ts

import Dexie from "dexie";
import type { UIMessage } from "ai";

interface ConversationRecord {
  quizId: string;
  messages: UIMessage[];
  updatedAt: number;
}

interface AgentDB extends Dexie {
  conversations: Dexie.Table<ConversationRecord, string>;
}

let db: AgentDB | null = null;

function getDb(): AgentDB {
  if (!db) {
    db = new Dexie("prism-agent") as AgentDB;
    db.version(1).stores({
      conversations: "quizId",
    });
  }
  return db;
}

export async function saveConversation(
  quizId: string,
  messages: UIMessage[]
): Promise<void> {
  if (typeof window === "undefined") return;
  await getDb().conversations.put({
    quizId,
    messages,
    updatedAt: Date.now(),
  });
}

export async function loadConversation(
  quizId: string
): Promise<UIMessage[]> {
  if (typeof window === "undefined") return [];
  const record = await getDb().conversations.get(quizId);
  return record?.messages ?? [];
}

export async function clearConversation(quizId: string): Promise<void> {
  if (typeof window === "undefined") return;
  await getDb().conversations.delete(quizId);
}

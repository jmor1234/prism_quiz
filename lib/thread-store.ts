"use client";

import Dexie, { Table } from "dexie";
import { nanoid } from "nanoid";
import type { UIMessage } from "ai";
import { extractMessageText } from "@/lib/message-utils";

export interface ThreadMeta {
	id: string;
	title: string;
	preview: string;
	updatedAt: number;
}

export interface ThreadPayload {
	threadId: string;
	messages: UIMessage[];
}

class ThreadDatabase extends Dexie {
	threads!: Table<ThreadMeta, string>;
	messages!: Table<ThreadPayload, string>;

	constructor() {
		super("agentic_research_core_threads");
		this.version(1).stores({
			threads: "id, updatedAt",
			messages: "threadId",
		});
	}
}

const db = typeof window !== "undefined" ? new ThreadDatabase() : (null as unknown as ThreadDatabase);

function deriveTitle(messages: UIMessage[]): string {
	// Prefer the first user text, fallback to first assistant text, else "New chat"
	const firstUser = messages.find((m) => m.role === "user");
	const firstAssistant = messages.find((m) => m.role === "assistant");
	const raw = extractMessageText(firstUser ?? firstAssistant as UIMessage) || "New chat";
	const title = raw.split("\n")[0].trim();
	return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

function derivePreview(messages: UIMessage[]): string {
	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const raw = lastAssistant ? extractMessageText(lastAssistant) : "";
	const oneLine = raw.replace(/\s+/g, " ").trim();
	return oneLine.length > 120 ? `${oneLine.slice(0, 117)}...` : oneLine;
}

export async function createThread(): Promise<string> {
	if (!db) return nanoid();
	const id = `thr_${nanoid(12)}`;
	const now = Date.now();
	await db.transaction("rw", db.threads, db.messages, async () => {
		await db.threads.put({ id, title: "New chat", preview: "", updatedAt: now });
		await db.messages.put({ threadId: id, messages: [] });
	});
	return id;
}

export async function saveThread(threadId: string, messages: UIMessage[]): Promise<void> {
	if (!db) return;
	const now = Date.now();
	const title = deriveTitle(messages);
	const preview = derivePreview(messages);
	await db.transaction("rw", db.threads, db.messages, async () => {
		await db.messages.put({ threadId, messages });
		await db.threads.put({ id: threadId, title, preview, updatedAt: now });
	});
}

export async function loadThread(threadId: string): Promise<UIMessage[]> {
	if (!db) return [];
	const payload = await db.messages.get({ threadId });
	return payload?.messages ?? [];
}

export async function listThreads(): Promise<ThreadMeta[]> {
	if (!db) return [];
	const rows = await db.threads.toArray();
	return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteThread(threadId: string): Promise<void> {
	if (!db) return;
	await db.transaction("rw", db.threads, db.messages, async () => {
		await db.threads.delete(threadId);
		await db.messages.delete(threadId);
	});
}

export async function renameThread(threadId: string, title: string): Promise<void> {
	if (!db) return;
	const row = await db.threads.get(threadId);
	if (!row) return;
	await db.threads.put({ ...row, title });
}

export type ThreadStore = {
	createThread: typeof createThread;
	saveThread: typeof saveThread;
	loadThread: typeof loadThread;
	listThreads: typeof listThreads;
	deleteThread: typeof deleteThread;
	renameThread: typeof renameThread;
};

export const threadStore: ThreadStore = {
	createThread,
	saveThread,
	loadThread,
	listThreads,
	deleteThread,
	renameThread,
};



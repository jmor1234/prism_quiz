import { ThreadChat } from "../thread-chat";
import type { UIMessage } from "ai";

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  // Dexie is client-side; we cannot load messages here on the server.
  // We render a client component that hydrates on mount.
  const initialMessages: UIMessage[] = [];
  return <ThreadChat threadId={threadId} initialMessages={initialMessages} />;
}



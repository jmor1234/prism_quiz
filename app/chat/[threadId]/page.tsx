import { ChatPage } from "./chat-page";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <ChatPage key={threadId} threadId={threadId} />;
}

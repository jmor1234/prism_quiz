"use client";

import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { ChatComposer } from "./components/chat-composer";
import { MessageRenderer } from "./components/message-renderer";

export default function ChatPage() {
  const { messages, status, sendMessage, stop, error } = useChat({
    experimental_throttle: 50,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Dark mode toggle - positioned in top-right corner */}
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Conversation className="mx-auto w-full max-w-2xl">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  <MessageRenderer message={message} />
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <ChatComposer
        onSubmit={sendMessage}
        status={status}
        onStop={stop}
      />

      {error ? (
        <div className="p-2 text-center text-xs text-red-600">{error.message}</div>
      ) : null}
    </div>
  );
}

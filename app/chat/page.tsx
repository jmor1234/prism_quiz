"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

export default function ChatPage() {
  const { messages, status, sendMessage, stop, error } = useChat({
    experimental_throttle: 50,
  });

  const renderParts = (message: UIMessage) => {
    return message.parts.map((part, idx) => {
      switch (part.type) {
        case "text":
          return <Response key={idx}>{part.text}</Response>;
        case "reasoning":
          return (
            <Reasoning
              key={idx}
              isStreaming={part.state === "streaming"}
              defaultOpen
            >
              <ReasoningTrigger />
              <ReasoningContent>{part.text}</ReasoningContent>
            </Reasoning>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <Conversation className="mx-auto w-full max-w-2xl">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>{renderParts(m)}</MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-2xl border-t">
        <PromptInput
          onSubmit={({ text, files }) => {
            const trimmed = text?.trim();
            if (trimmed) {
              sendMessage({ text: trimmed, files });
              return;
            }
            if (files && files.length > 0) {
              sendMessage({ files });
            }
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder="Ask something..." />
          </PromptInputBody>
          <PromptInputToolbar>
            <div />
            <PromptInputSubmit
              status={status}
              onClick={(e) => {
                if (status === "streaming") {
                  e.preventDefault();
                  stop();
                }
              }}
            />
          </PromptInputToolbar>
        </PromptInput>
      </div>

      {error ? (
        <div className="p-2 text-center text-xs text-red-600">{error.message}</div>
      ) : null}
    </div>
  );
}

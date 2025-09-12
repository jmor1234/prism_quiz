"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageEditForm } from "@/components/ai-elements/message-edit";
import { ChatComposer } from "./components/chat-composer";
import { MessageRenderer } from "./components/message-renderer";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { saveThread, loadThread } from "@/lib/thread-store";

function useMessageVisibility(messages: UIMessage[]) {
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);

  const lastUserMessageId = useMemo(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    return lastUserMsg?.id ?? null;
  }, [messages]);

  useEffect(() => {
    setShowPreviousMessages(false);
  }, [lastUserMessageId]);

  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    if (showPreviousMessages) return messages;
    const lastUserMessageIndex = messages
      .map((msg: UIMessage, index: number) => ({ role: msg.role, index }))
      .filter((m: { role: UIMessage["role"] }) => m.role === "user")
      .pop()?.index ?? 0;
    return messages.slice(lastUserMessageIndex);
  }, [messages, showPreviousMessages]);

  const hasPreviousMessages = messages.length > visibleMessages.length;

  const togglePreviousMessages = useCallback(() => {
    setShowPreviousMessages((prev) => !prev);
  }, []);

  return {
    visibleMessages,
    hasPreviousMessages,
    showPreviousMessages,
    togglePreviousMessages,
  };
}

export function ThreadChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const { messages, status, sendMessage, stop, error, setMessages } = useChat({
    id: threadId,
    experimental_throttle: 50,
  });

  // Hydrate messages on mount/thread change from local store
  useEffect(() => {
    (async () => {
      try {
        const msgs = await loadThread(threadId);
        setMessages(msgs.length ? msgs : initialMessages);
      } catch {
        setMessages(initialMessages);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Ensure any in-flight request is stopped when unmounting (thread switch/nav)
  useEffect(() => {
    return () => {
      try { stop(); } catch {}
    };
  }, [stop]);

  const {
    visibleMessages,
    hasPreviousMessages,
    showPreviousMessages,
    togglePreviousMessages,
  } = useMessageVisibility(messages as UIMessage[]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const canEdit = status === 'ready';

  const handleStartEdit = useCallback((messageId: string) => {
    if (canEdit) {
      setEditingMessageId(messageId);
    }
  }, [canEdit]);

  const handleEditSave = useCallback((messageId: string, newText: string) => {
    try {
      const trimmedText = newText.trim();
      if (!trimmedText) {
        console.warn('Cannot save empty message');
        return;
      }

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn(`Message with id ${messageId} not found`);
        return;
      }

      const originalMessage = messages[messageIndex];

      stop();

      if (originalMessage.role === 'user') {
        setMessages(prev => prev.slice(0, messageIndex));
        sendMessage({ text: trimmedText });
      } else {
        const updated = [...messages];
        updated[messageIndex] = {
          ...updated[messageIndex],
          parts: [
            {
              type: 'text' as const,
              text: trimmedText,
            },
          ],
        } as UIMessage;
        setMessages(updated);
        void saveThread(threadId, updated as UIMessage[]);
      }

      setEditingMessageId(null);
    } catch (error) {
      console.error('Error saving message edit:', error);
    }
  }, [messages, setMessages, sendMessage, stop, threadId]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  // Persist finalized snapshots when streaming completes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasReady = prevStatusRef.current === 'ready';
    const isNowReady = status === 'ready';
    if (!wasReady && isNowReady && messages.length > 0) {
      void saveThread(threadId, messages as UIMessage[]);
    }
    prevStatusRef.current = status;
  }, [status, messages, threadId]);

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Conversation className="mx-auto w-full max-w-3xl flex-1 min-h-0">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            <>
              {hasPreviousMessages && (
                <div className="w-full flex justify-center py-2">
                  <Button
                    onClick={togglePreviousMessages}
                    size="sm"
                    variant="outline"
                    type="button"
                    className="h-7 gap-1"
                  >
                    {showPreviousMessages ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" /> Hide previous
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" /> Show previous
                      </>
                    )}
                  </Button>
                </div>
              )}

              {visibleMessages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent
                    message={message}
                    onEdit={
                      canEdit ? () => handleStartEdit(message.id) : undefined
                    }
                  >
                    {editingMessageId === message.id ? (
                      <MessageEditForm
                        message={message}
                        onSave={(newText) =>
                          handleEditSave(message.id, newText)
                        }
                        onCancel={handleEditCancel}
                      />
                    ) : (
                      <MessageRenderer message={message} />
                    )}
                  </MessageContent>
                </Message>
              ))}
            </>
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



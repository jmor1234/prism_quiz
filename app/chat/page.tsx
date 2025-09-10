"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import { ModeToggle } from "@/components/ui/mode-toggle";
import { ChatComposer } from "./components/chat-composer";
import { MessageRenderer } from "./components/message-renderer";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";

// Show only the latest user→assistant exchange by default,
// with a toggle to reveal the full history on demand.
function useMessageVisibility(messages: UIMessage[]) {
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);

  // Track the most recent user message ID
  const lastUserMessageId = useMemo(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    return lastUserMsg?.id ?? null;
  }, [messages]);

  // Reset to only show the latest exchange when a NEW user message appears
  useEffect(() => {
    setShowPreviousMessages(false);
  }, [lastUserMessageId]);

  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    if (showPreviousMessages) return messages;

    // Find the index of the last user message; show from there onward
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

export default function ChatPage() {
  const { messages, status, sendMessage, stop, error, setMessages } = useChat({
    experimental_throttle: 50,
  });

  // Determine which messages to render (latest pair by default)
  const {
    visibleMessages,
    hasPreviousMessages,
    showPreviousMessages,
    togglePreviousMessages,
  } = useMessageVisibility(messages as UIMessage[]);

  // Edit state management
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Streaming safety - prevent editing during AI responses
  const canEdit = status === 'ready';

  // Handle starting edit mode
  const handleStartEdit = useCallback((messageId: string) => {
    if (canEdit) {
      setEditingMessageId(messageId);
    }
  }, [canEdit]);

  // Handle saving edit (truncates conversation and triggers AI response)
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
      if (originalMessage.role !== 'user') {
        console.warn('Can only edit user messages');
        return;
      }

      // Stop any in-flight AI response
      stop();

      // Truncate conversation to edit point
      setMessages(prev => prev.slice(0, messageIndex));

      // Send edited message (triggers AI response with truncated history)
      sendMessage({ text: trimmedText });

      // Clear editing state
      setEditingMessageId(null);
    } catch (error) {
      console.error('Error saving message edit:', error);
      // Keep edit state so user can try again
    }
  }, [messages, setMessages, sendMessage, stop]);

  // Handle canceling edit
  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Dark mode toggle - positioned in top-right corner */}
      <div className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </div>

      <Conversation className="mx-auto w-full max-w-3xl">
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

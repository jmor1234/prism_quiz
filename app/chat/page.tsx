"use client";

import { useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
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

export default function ChatPage() {
  const { messages, status, sendMessage, stop, error, setMessages } = useChat({
    experimental_throttle: 50,
  });

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

      <Conversation className="mx-auto w-full max-w-2xl">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            messages.map((message) => (
              <Message key={message.id} from={message.role}>
                <MessageContent 
                  message={message}
                  onEdit={canEdit ? () => handleStartEdit(message.id) : undefined}
                >
                  {editingMessageId === message.id ? (
                    <MessageEditForm
                      message={message}
                      onSave={(newText) => handleEditSave(message.id, newText)}
                      onCancel={handleEditCancel}
                    />
                  ) : (
                    <MessageRenderer message={message} />
                  )}
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

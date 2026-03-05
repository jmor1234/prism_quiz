"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { UIMessage } from "ai";
import { loadMessages, saveMessages } from "@/lib/chat/thread-store";
import { saveChatConversationRemote } from "@/lib/tracking";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export function useChatPersistence({
  threadId,
  messages,
  setMessages,
  status,
}: {
  threadId: string;
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  status: ChatStatus;
}) {
  const [hydrated, setHydrated] = useState(false);
  const prevStatusRef = useRef<ChatStatus>(status);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    loadMessages(threadId).then((stored) => {
      if (cancelled) return;
      if (stored.length > 0) {
        setMessages(stored);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [threadId, setMessages]);

  // Save when streaming completes
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    const wasActive = prev === "streaming" || prev === "submitted";
    if (wasActive && status === "ready" && messages.length > 0) {
      saveMessages(threadId, messages);

      // Also save to server for admin visibility
      const serialized: { role: "user" | "assistant"; text: string }[] = [];
      for (const m of messages) {
        if (m.role !== "user" && m.role !== "assistant") continue;
        const text = m.parts.reduce(
          (acc, p) =>
            p.type === "text"
              ? acc + (acc ? "\n" : "") + (p as { type: "text"; text: string }).text
              : acc,
          ""
        );
        if (text.length > 0) {
          serialized.push({ role: m.role, text });
        }
      }
      saveChatConversationRemote(threadId, serialized);
    }
  }, [status, threadId, messages]);

  const forceSave = useCallback(() => {
    if (messages.length > 0) {
      saveMessages(threadId, messages);
    }
  }, [threadId, messages]);

  return { forceSave, hydrated };
}

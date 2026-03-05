"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { UIMessage } from "ai";
import {
  loadConversation,
  saveConversation,
} from "@/lib/agent/thread-store";
import { saveConversationRemote } from "@/lib/tracking";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export function useAgentPersistence({
  quizId,
  messages,
  setMessages,
  status,
}: {
  quizId: string;
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
  status: ChatStatus;
}) {
  const [hydrated, setHydrated] = useState(false);
  const prevStatusRef = useRef<ChatStatus>(status);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    loadConversation(quizId).then((stored) => {
      if (cancelled) return;
      if (stored.length > 0) {
        setMessages(stored);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [quizId, setMessages]);

  // Save when streaming completes
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    const wasActive = prev === "streaming" || prev === "submitted";
    if (wasActive && status === "ready" && messages.length > 0) {
      saveConversation(quizId, messages);

      // Also save to server for admin visibility
      const serialized: { role: "user" | "assistant"; text: string }[] = [];
      for (const m of messages) {
        if (m.role !== "user" && m.role !== "assistant") continue;
        const text = m.parts
          .reduce((acc, p) => (p.type === "text" ? acc + (acc ? "\n" : "") + (p as { type: "text"; text: string }).text : acc), "");
        if (text.length > 0) {
          serialized.push({ role: m.role, text });
        }
      }
      saveConversationRemote(quizId, serialized);
    }
  }, [status, quizId, messages]);

  // Manual save for cases where you need to force-persist
  const forceSave = useCallback(() => {
    if (messages.length > 0) {
      saveConversation(quizId, messages);
    }
  }, [quizId, messages]);

  return { forceSave, hydrated };
}

// lib/tracking.ts

import type { SerializedMessage } from "@/server/quizEngagement";

/**
 * Fire-and-forget engagement event tracking.
 * Uses keepalive to survive page navigation.
 */
export function trackEvent(
  quizId: string,
  type: string,
  source: string
): void {
  try {
    fetch("/api/quiz/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, event: { type, source } }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow errors (e.g., SSR context)
  }
}

/**
 * Fire-and-forget conversation save to server.
 * Uses keepalive to survive page navigation.
 */
export function saveConversationRemote(
  quizId: string,
  messages: SerializedMessage[]
): void {
  try {
    fetch("/api/quiz/engagement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quizId, conversation: messages }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow errors
  }
}

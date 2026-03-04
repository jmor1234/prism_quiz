// app/api/agent/lib/inputValidation.ts

import type { UIMessage } from "ai";

function envInt(key: string): number | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const MAX_LENGTH = envInt("MAX_MESSAGE_LENGTH") ?? 15000;

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; status: number };

export function validateInput(messages: UIMessage[]): ValidationResult {
  if (!Array.isArray(messages) || messages.length === 0) {
    return { valid: false, error: "Messages are required.", status: 400 };
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return { valid: false, error: "Invalid request.", status: 400 };
  }

  const lastText = lastMessage.parts?.find(
    (p): p is Extract<(typeof lastMessage.parts)[number], { type: "text" }> =>
      p.type === "text"
  );
  if (lastText && lastText.text.length > MAX_LENGTH) {
    return {
      valid: false,
      error: "Your message is too long. Please shorten it and try again.",
      status: 400,
    };
  }

  return { valid: true };
}

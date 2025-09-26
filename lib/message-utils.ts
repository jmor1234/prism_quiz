import type { UIMessage, FileUIPart } from "ai";

/**
 * Extracts text content from a UIMessage, handling both user and assistant messages.
 * For user messages: returns all text parts
 * For assistant messages: returns only text parts (excludes reasoning)
 */
export const extractMessageText = (message: UIMessage): string => {
  // Handle edge cases
  if (!message?.parts?.length) {
    return "";
  }

  // Both user and assistant messages: extract only text parts (excludes reasoning for assistants)
  const textParts = message.parts
    .filter((part): part is { type: "text"; text: string } =>
      part?.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .filter(Boolean);

  return textParts.join("\n\n").trim();
};

/**
 * Extracts file parts from a UIMessage
 */
export const extractMessageFiles = (message: UIMessage): FileUIPart[] => {
  if (!message?.parts?.length) {
    return [];
  }

  return message.parts
    .filter((part): part is FileUIPart =>
      part?.type === "file"
    );
};

/**
 * Extracts both text and files from a UIMessage for resending
 */
export const extractMessageContent = (message: UIMessage): {
  text: string;
  files: FileUIPart[];
} => {
  return {
    text: extractMessageText(message),
    files: extractMessageFiles(message),
  };
};

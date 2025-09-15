// app/api/chat/systemPrompt.ts

// Base system prompt content that you can edit independently.
export const SYSTEM_PROMPT_BASE =
  'You are a helpful assistant. Use the think tool after receiving tool results or when planning multi-step actions to verify policies, check missing info, and outline next steps succinctly.';

// Helper to compose a time-aware system prompt while keeping the editable base separate.
export function buildSystemPrompt(formattedDate: string): string {
  const timeAware = `It is CRITICAL that you factor in the current date; time awareness is CRITICAL for research quality. For up to date information, consider specifying the year 2025 in objectives. Current date: ${formattedDate}`;
  return `${timeAware}\n\n${SYSTEM_PROMPT_BASE}`;
}



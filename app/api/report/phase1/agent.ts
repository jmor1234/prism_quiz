import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface Phase1AgentResult {
  rootCauseReport: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export async function runPhase1Agent(prompt: string): Promise<Phase1AgentResult> {
  const { text, usage } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250929"),
    prompt,
  });

  return {
    rootCauseReport: text,
    usage,
  };
}

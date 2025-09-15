// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { thinkTool } from './tools/thinkTool/think-tool';
import { researchMemoryTool } from './tools/researchMemoryTool/researchMemoryTool';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful assistant. Use the think tool after receiving tool results or when planning multi-step actions to verify policies, check missing info, and outline next steps succinctly.',
    messages: convertToModelMessages(messages),
    tools: {
      thinkTool: thinkTool,
      researchMemoryTool: researchMemoryTool,
    },
    providerOptions: {
        anthropic: {
            thinking: { type: 'enabled', budgetTokens: 16000 }
        }
    }
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
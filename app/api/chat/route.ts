// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
    providerOptions: {
        anthropic: {
            thinking: { type: 'enabled', budgetTokens: 16000 }
        }
    }
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
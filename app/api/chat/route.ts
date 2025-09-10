// app/api/chat/route.ts

import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, UIMessage } from 'ai';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai('gpt-5'),
    system: 'You are a helpful assistant.',
    messages: convertToModelMessages(messages),
    providerOptions: {
        openai: {
            reasoningEffort: 'low',
            reasoningSummary: 'detailed',
            include: ['reasoning.encrypted_content']
        }
    }
  });

  return result.toUIMessageStreamResponse({ sendReasoning: true });
}
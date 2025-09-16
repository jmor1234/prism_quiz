// app/api/chat/route.ts

import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, UIMessage, stepCountIs } from 'ai';
import { thinkTool } from './tools/thinkTool/think-tool';
import { researchMemoryTool } from './tools/researchMemoryTool/researchMemoryTool';
import { targetedExtractionTool } from './tools/targetedExtractionTool/targetedExtractionTool';
import { executeResearchPlanTool } from './tools/executeResearchPlanTool/executeResearchPlanTool';
import { TraceLogger, asyncLocalStorage } from './lib/traceLogger';
import { buildSystemPrompt } from './systemPrompt';

export const maxDuration = 300;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Initialize per-request trace logger and run the request in its async context
  const enableLogging = process.env.ENABLE_DETAILED_TRACE_LOGGING === 'true';
  const logger = new TraceLogger();
  logger.setEnabled(enableLogging);
  logger.logInitialMessages(messages as unknown as unknown[]);

  return await asyncLocalStorage.run(logger, async () => {
    let stepIndex = 0;
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const dynamicSystemPrompt = buildSystemPrompt(formattedDate);

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: dynamicSystemPrompt,
      messages: convertToModelMessages(messages),
      tools: {
        thinkTool: thinkTool,
        researchMemoryTool: researchMemoryTool,
        targetedExtractionTool: targetedExtractionTool,
        executeResearchPlanTool: executeResearchPlanTool,
      },
      // No forced tool gating; allow the model to choose dynamically
      // Agentic controls (v5): limit sequential steps to prevent runaway loops
      stopWhen: stepCountIs(50),
      // Observability for each step
      onStepFinish: (step) => {
        stepIndex += 1;
        logger.logToolInternalStep('primary_agent', 'STEP_FINISH', {
          stepIndex,
          finishReason: step.finishReason,
          usage: step.usage,
          toolCalls: step.toolCalls.map((tc) => ({ toolName: tc.toolName })),
        });

        // Console visibility for token usage per step (total only)
        const u = step.usage as unknown as { totalTokens?: number };
        console.log(`\n==================== TOKENS (STEP ${stepIndex}) ====================`);
        console.log(`🧮 total: ${u.totalTokens ?? 'n/a'}`);
        console.log(`==================================================================`);

        // Capture planning thoughts from thinkTool calls
        const thinkCall = step.toolCalls.find((tc) => tc.toolName === 'thinkTool') as unknown as { args?: { thought?: string } } | undefined;
        const thought = thinkCall?.args?.thought;
        if (thought && typeof thought === 'string') {
          logger.logAgentPlanning(thought);
        }
      },
      // Provider-specific options
      providerOptions: {
        anthropic: {
          thinking: { type: 'enabled', budgetTokens: 16000 },
        },
      },
      // Finalize logs when the run completes
      onFinish: async (event) => {
        const runTotal = (event.totalUsage as unknown as { totalTokens?: number })?.totalTokens;
        console.log(`\n====================== TOKENS (RUN) =======================`);
        console.log(`🧾 total: ${runTotal ?? 'n/a'}`);
        console.log(`==========================================================`);
        logger.logFinalResponse({
          text: event.text,
          finishReason: event.finishReason,
          usage: event.totalUsage,
        });
        await logger.finalizeAndWriteLog();
      },
      onError: async (e) => {
        await logger.finalizeAndWriteLog(e);
      },
      onAbort: async (event) => {
        await logger.finalizeAndWriteLog({ reason: 'aborted', steps: event.steps.length });
      },
    });

    return result.toUIMessageStreamResponse({ sendReasoning: true });
  });
}
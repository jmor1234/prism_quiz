"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useEffect, useRef, useCallback, useMemo } from "react";
import { useAgentPersistence } from "@/hooks/use-agent-persistence";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { ToolStatus } from "@/components/ai-elements/tool-status";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  SourceList,
} from "@/components/ai-elements/sources";
import { Reasoning } from "@/components/ai-elements/reasoning";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { extractMessageText, extractCitationUrls } from "@/lib/message-utils";
import { trackEvent } from "@/lib/tracking";

const AUTO_TRIGGER_TEXT =
  "I just finished the quiz and read through my assessment. I clicked to chat with you to learn more.";

const TOOL_LABELS: Record<string, string> = {
  search: "Researching",
  read: "Reading source",
  extract_findings: "Analyzing source",
};

export function AgentPage({
  quizId,
}: {
  quizId: string;
}) {
  const hasTriggeredFirstMessage = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { quizId },
      }),
    [quizId]
  );

  const { messages, setMessages, status, error, sendMessage, stop } = useChat({
    id: quizId,
    transport,
    experimental_throttle: 50,
  });

  const { hydrated } = useAgentPersistence({ quizId, messages, setMessages, status });

  // Auto-trigger first message (hidden from UI)
  // Waits for IndexedDB hydration to complete before deciding
  useEffect(() => {
    if (hasTriggeredFirstMessage.current) return;
    if (!hydrated) return;
    if (messages.length > 0) return;

    hasTriggeredFirstMessage.current = true;
    sendMessage({ text: AUTO_TRIGGER_TEXT });
  }, [hydrated, messages.length, sendMessage]);

  const handleSendMessage = useCallback(
    (msg: { text?: string }) => {
      if (msg.text?.trim()) {
        sendMessage({ text: msg.text });
      }
    },
    [sendMessage]
  );

  // Filter out the auto-trigger message for rendering
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m, i) =>
          !(
            i === 0 &&
            m.role === "user" &&
            m.parts.some(
              (p) => p.type === "text" && p.text === AUTO_TRIGGER_TEXT
            )
          )
      ),
    [messages]
  );

  const isStreaming = status === "streaming" || status === "submitted";

  // Derive active tool status from message parts
  const activeToolStatus = useMemo(() => {
    if (!isStreaming) return null;
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "assistant") return null;
    for (const part of lastMessage.parts) {
      if (
        isToolUIPart(part) &&
        part.state !== "output-available" &&
        part.state !== "output-error"
      ) {
        const name = getToolName(part);
        return {
          toolName: name,
          action: TOOL_LABELS[name] ?? `Running ${name}`,
        };
      }
    }
    return null;
  }, [isStreaming, messages]);

  // Extract citation sources from last assistant message
  const citationSources = useMemo(() => {
    const lastAssistant = messages.findLast((m) => m.role === "assistant");
    if (!lastAssistant) return [];
    const text = extractMessageText(lastAssistant);
    return extractCitationUrls(text);
  }, [messages]);

  const lastVisibleAssistantId = useMemo(() => {
    return visibleMessages.findLast((m) => m.role === "assistant")?.id ?? null;
  }, [visibleMessages]);

  // Detect booking link clicks in agent markdown responses
  const handleConversationClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor?.getAttribute("href")?.includes("prism.miami")) {
        trackEvent(quizId, "booking_click", "agent");
      }
    },
    [quizId]
  );

  return (
    <div className="h-dvh flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-sm font-medium text-muted-foreground">
            Prism Health
          </h1>
          <ModeToggle />
        </div>
      </header>

      {/* Messages */}
      <Conversation className="flex-1">
        <ConversationContent className="max-w-2xl mx-auto px-4 md:px-8 py-6" onClick={handleConversationClick}>
          {visibleMessages.map((message) => {
            const isLastAssistant =
              message.role === "assistant" &&
              message.id === lastVisibleAssistantId;
            const isLastMessage =
              message.id === messages[messages.length - 1]?.id;

            return (
              <Message key={message.id} from={message.role}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    if (part.type === "text") {
                      return message.role === "assistant" ? (
                        <Response key={i}>{part.text}</Response>
                      ) : (
                        <span key={i}>{part.text}</span>
                      );
                    }
                    if (part.type === "reasoning") {
                      return (
                        <Reasoning
                          key={i}
                          text={part.text}
                          state={
                            isStreaming && isLastMessage
                              ? "streaming"
                              : "done"
                          }
                        />
                      );
                    }
                    return null;
                  })}
                  {isLastAssistant &&
                    citationSources.length > 0 &&
                    !isStreaming && (
                      <div className="mt-3">
                        <Sources>
                          <SourcesTrigger count={citationSources.length} />
                          <SourcesContent>
                            <SourceList items={citationSources} />
                          </SourcesContent>
                        </Sources>
                      </div>
                    )}
                </MessageContent>
              </Message>
            );
          })}

          {/* Tool status / loading indicator */}
          {isStreaming ? (
            activeToolStatus ? (
              <ToolStatus
                toolName={activeToolStatus.toolName}
                action={activeToolStatus.action}
              />
            ) : (
              <ToolStatus toolName="think" action="" variant="dots" />
            )
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Error banner */}
      {error && (
        <div role="alert" className="px-4 py-2 bg-destructive/10 text-destructive text-sm text-center">
          {error.message}
        </div>
      )}

      {/* Composer */}
      <div className="border-t bg-background px-4 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-2xl mx-auto py-2">
          <PromptInput
            onSubmit={handleSendMessage}
            className="border-border/50"
          >
            <PromptInputTextarea
              aria-label="Message"
              placeholder="Ask about your health patterns\u2026"
              data-status={status}
              autoComplete="off"
            />
            <PromptInputToolbar>
              <div />
              <PromptInputSubmit
                aria-label={status === "streaming" ? "Stop generating" : "Send message"}
                status={status}
                onClick={
                  status === "streaming" ? () => stop() : undefined
                }
                className="bg-[var(--quiz-gold)] text-white hover:bg-[var(--quiz-gold)]/90"
              />
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

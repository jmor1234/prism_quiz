"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, getToolName } from "ai";
import { useCallback, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useChatPersistence } from "@/hooks/use-chat-persistence";
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
import { ChatSidebar } from "@/components/chat-sidebar";
import { extractMessageText, extractCitationUrls } from "@/lib/message-utils";
import { trackChatEvent } from "@/lib/tracking";
import { Plus, Menu, X, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { createThread } from "@/lib/chat/thread-store";
import { Button } from "@/components/ui/button";

const TOOL_LABELS: Record<string, string> = {
  search: "Researching",
  read: "Reading source",
  extract_findings: "Analyzing source",
};

export function ChatPage({ threadId }: { threadId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
      }),
    []
  );

  const { messages, setMessages, status, error, sendMessage, stop } = useChat({
    id: threadId,
    transport,
    experimental_throttle: 50,
  });

  const { hydrated } = useChatPersistence({
    threadId,
    messages,
    setMessages,
    status,
  });

  const handleSendMessage = useCallback(
    (msg: { text?: string }) => {
      if (msg.text?.trim()) {
        sendMessage({ text: msg.text });
      }
    },
    [sendMessage]
  );

  const handleNewThread = useCallback(async () => {
    const id = await createThread();
    router.push(`/chat/${id}`);
    setSidebarOpen(false);
  }, [router]);

  const isStreaming = status === "streaming" || status === "submitted";

  // Derive active tool status
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

  const lastAssistantId = useMemo(() => {
    return messages.findLast((m) => m.role === "assistant")?.id ?? null;
  }, [messages]);

  // Detect booking link clicks
  const handleConversationClick = useCallback(
    (e: React.MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (anchor?.getAttribute("href")?.includes("prism.miami")) {
        trackChatEvent(threadId, "booking_click", "chat");
      }
    },
    [threadId]
  );

  return (
    <div className="h-dvh flex bg-background">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 border-r bg-background transition-transform duration-200
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewThread}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <button
              className="md:hidden p-1.5 rounded-md hover:bg-muted"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ChatSidebar
          activeThreadId={threadId}
          onSelectThread={(id) => {
            router.push(`/chat/${id}`);
            setSidebarOpen(false);
          }}
          pathname={pathname}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="md:hidden p-1.5 rounded-md hover:bg-muted"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link
                href="/quiz"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Assessments
              </Link>
            </div>
            <ModeToggle />
          </div>
        </header>

        {/* Messages */}
        <Conversation className="flex-1">
          <ConversationContent
            className="max-w-2xl mx-auto px-4 md:px-8 py-6"
            onClick={handleConversationClick}
          >
            {/* Empty state */}
            {hydrated && messages.length === 0 && !isStreaming && (
              <div className="flex items-center justify-center min-h-[40vh]">
                <p className="text-lg text-muted-foreground text-center max-w-md leading-relaxed">
                  What&apos;s your biggest health struggle right now, or your most important health goal?
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isLastAssistant =
                message.role === "assistant" &&
                message.id === lastAssistantId;
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
                      !isStreaming ? (
                        <div className="mt-3">
                          <Sources>
                            <SourcesTrigger count={citationSources.length} />
                            <SourcesContent>
                              <SourceList items={citationSources} />
                            </SourcesContent>
                          </Sources>
                        </div>
                      ) : null}
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
          <div
            role="alert"
            className="px-4 py-2 bg-destructive/10 text-destructive text-sm text-center"
          >
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
                placeholder="Share what's going on..."
                data-status={status}
                autoComplete="off"
              />
              <PromptInputToolbar>
                <div />
                <PromptInputSubmit
                  aria-label={
                    status === "streaming" ? "Stop generating" : "Send message"
                  }
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
    </div>
  );
}

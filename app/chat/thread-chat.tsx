// app/chat/thread-chat.tsx


"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { MessageEditForm } from "@/components/ai-elements/message-edit";
import { ChatComposer } from "./components/chat-composer";
import { MessageRenderer } from "./components/message-renderer";
import { canonicalizeUrlForDedupe } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { saveThread, loadThread, createThread } from "@/lib/thread-store";
import { ResearchProgress } from "@/components/research-progress";
import { ExtractionProgress } from "@/components/extraction-progress";
import { ErrorBanner } from "@/components/error-banner";
import { extractMessageContent, extractMessageText } from "@/lib/message-utils";
import type {
  ResearchState,
  ResearchSessionData,
  ResearchObjectiveData,
  ResearchPhaseData,
  ResearchOperationData,
  SearchProgressData,
  ResearchErrorData,
  ContextWarningData,
} from "@/lib/streaming-types";
import { Sources, SourcesTrigger, SourcesContent, SourceList } from "@/components/ai-elements/sources";
import { ToolStatus } from "@/components/ai-elements/tool-status";

function useMessageVisibility(messages: UIMessage[]) {
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);

  const lastUserMessageId = useMemo(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    return lastUserMsg?.id ?? null;
  }, [messages]);

  useEffect(() => {
    setShowPreviousMessages(false);
  }, [lastUserMessageId]);

  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];
    if (showPreviousMessages) return messages;
    const lastUserMessageIndex = messages
      .map((msg: UIMessage, index: number) => ({ role: msg.role, index }))
      .filter((m: { role: UIMessage["role"] }) => m.role === "user")
      .pop()?.index ?? 0;
    return messages.slice(lastUserMessageIndex);
  }, [messages, showPreviousMessages]);

  const hasPreviousMessages = messages.length > visibleMessages.length;

  const togglePreviousMessages = useCallback(() => {
    setShowPreviousMessages((prev) => !prev);
  }, []);

  return {
    visibleMessages,
    hasPreviousMessages,
    showPreviousMessages,
    togglePreviousMessages,
  };
}

export function ThreadChat({ threadId, initialMessages }: { threadId: string; initialMessages: UIMessage[] }) {
  const router = useRouter();

  // Context warning state (separate from research state)
  const [contextWarning, setContextWarning] = useState<ContextWarningData | null>(null);

  // Error state with dismissal tracking
  const [dismissedError, setDismissedError] = useState(false);

  // Research progress state
  const [researchState, setResearchState] = useState<ResearchState>({
    session: null,
    objectives: {},
    phases: {},
    currentOperation: null,
    searchProgress: null,
    lastError: null,
    currentToolStatus: null,
    extractionSession: null,
    extractionUrls: {},
    collections: {},
    sourcesByObjective: {},
  });

  // Tool status exit animation staging
  const [toolStatusExiting, setToolStatusExiting] = useState(false);
  const toolStatusExitStartRef = useRef<number | null>(null);
  const toolStatusRemoveRef = useRef<number | null>(null);

  // Fallback planning indicator (when no tool/session/extraction activity is visible)
  const [showPlanningIndicator, setShowPlanningIndicator] = useState(false);
  const [planningExiting, setPlanningExiting] = useState(false);
  const planningExitRef = useRef<number | null>(null);
  const planningRemoveRef = useRef<number | null>(null);
  const planningShowDelayRef = useRef<number | null>(null);

  // Compute when to show planning: streaming but no explicit tool status or progress UIs

  // Planning indicator visibility is computed after we have streaming status

  const { messages, status, sendMessage, stop, error, setMessages } = useChat({
    id: threadId,
    experimental_throttle: 50,
    onData: ({ data, type, id }) => {
      // Handle research progress data parts
      switch (type) {
        case 'data-research-session':
          setResearchState((prev) => ({
            ...prev,
            session: data as ResearchSessionData,
          }));
          break;
        case 'data-research-objective':
          if (id) {
            setResearchState((prev) => ({
              ...prev,
              objectives: {
                ...prev.objectives,
                [id]: data as ResearchObjectiveData,
              },
            }));
          }
          break;
        case 'data-research-phase':
          if (id) {
            setResearchState((prev) => ({
              ...prev,
              phases: {
                ...prev.phases,
                [id]: data as ResearchPhaseData,
              },
            }));
          }
          break;
        case 'data-research-operation':
          setResearchState((prev) => ({
            ...prev,
            currentOperation: data as ResearchOperationData,
          }));
          // Auto-clear after 3 seconds
          setTimeout(() => {
            setResearchState((prev) => ({
              ...prev,
              currentOperation: null,
            }));
          }, 3000);
          break;
        case 'data-search-progress':
          setResearchState((prev) => ({
            ...prev,
            searchProgress: data as SearchProgressData,
          }));
          break;
        case 'data-research-error':
          setResearchState((prev) => ({
            ...prev,
            lastError: data as ResearchErrorData,
          }));
          // Auto-clear after 5 seconds
          setTimeout(() => {
            setResearchState((prev) => ({
              ...prev,
              lastError: null,
            }));
          }, 5000);
          break;
        case 'data-tool-status':
          // Stage in → exit → remove for smooth transition
          try {
            // Clear any pending exit timers before scheduling new ones
            if (toolStatusExitStartRef.current) {
              clearTimeout(toolStatusExitStartRef.current);
              toolStatusExitStartRef.current = null;
            }
            if (toolStatusRemoveRef.current) {
              clearTimeout(toolStatusRemoveRef.current);
              toolStatusRemoveRef.current = null;
            }
          } catch {}

          setResearchState((prev) => ({
            ...prev,
            currentToolStatus: data as import('@/lib/streaming-types').ToolStatusData,
          }));
          setToolStatusExiting(false);

          // Begin exit after a short display window
          toolStatusExitStartRef.current = window.setTimeout(() => {
            setToolStatusExiting(true);
          }, 1200);

          // Remove after exit animation completes
          toolStatusRemoveRef.current = window.setTimeout(() => {
            setResearchState((prev) => ({
              ...prev,
              currentToolStatus: null,
            }));
            setToolStatusExiting(false);
          }, 1600);
          break;
        case 'data-context-warning':
          setContextWarning(data as ContextWarningData);
          break;
        case 'data-extraction-session':
          setResearchState((prev) => ({
            ...prev,
            extractionSession: data as import('@/lib/streaming-types').ExtractionSessionData,
          }));
          break;
        case 'data-extraction-url':
          if (id) {
            setResearchState((prev) => ({
              ...prev,
              extractionUrls: {
                ...prev.extractionUrls,
                [id]: data as import('@/lib/streaming-types').ExtractionUrlData,
              },
            }));
          }
          break;
        case 'data-research-collection': {
          if (!id) break;
          const payload = data as import('@/lib/streaming-types').ResearchCollectionData;
          setResearchState((prev) => {
            const existing = prev.collections?.[id];
            let items = payload.items;
            if (existing && payload.action === 'append') {
              items = [...existing.items, ...payload.items];
            }
            return {
              ...prev,
              collections: {
                ...(prev.collections || {}),
                [id]: { kind: payload.kind, total: payload.total, items },
              },
            };
          });
          break;
        }
        case 'data-research-sources': {
          const payload = data as import('@/lib/streaming-types').ResearchSourcesData;
          const objId = payload.objectiveId ?? 'session';
          setResearchState((prev) => {
            const existing = prev.sourcesByObjective?.[objId]?.items || [];
            // Merge by canonical URL; prefer items with title
            const byKey = new Map<string, { url: string; title?: string; domain?: string }>();
            const insert = (arr: { url: string; title?: string; domain?: string }[]) => {
              for (const s of arr) {
                const key = canonicalizeUrlForDedupe(s.url || '');
                if (!key) continue;
                const current = byKey.get(key);
                if (!current) {
                  byKey.set(key, s);
                } else if (!current.title && s.title) {
                  byKey.set(key, { ...s });
                }
              }
            };
            insert(existing);
            insert(payload.items || []);
            const merged = Array.from(byKey.values());
            return {
              ...prev,
              sourcesByObjective: {
                ...(prev.sourcesByObjective || {}),
                [objId]: { items: merged },
              },
            };
          });
          break;
        }
        // claimSpans removed
      }
    },
  });

  // Client-side token estimation (refresh-resilient fallback)
  const estimatedTokens = useMemo(() => {
    if (messages.length === 0) return 3000;
    const allText = messages.map(m => extractMessageText(m)).join(' ');
    return 3000 + Math.floor(allText.length / 4);
  }, [messages]);

  // Effective context warning (server data wins, client estimation as fallback)
  const effectiveContextWarning = useMemo(() => {
    if (contextWarning) return contextWarning;

    if (estimatedTokens > 100_000) {
      return {
        level: 'critical' as const,
        persistentTokens: estimatedTokens,
        message: 'Conversation has reached maximum context size.',
        timestamp: Date.now(),
      };
    }
    if (estimatedTokens > 95_000) {
      return {
        level: 'critical' as const,
        persistentTokens: estimatedTokens,
        message: 'Conversation approaching maximum context limit.',
        timestamp: Date.now(),
      };
    }
    if (estimatedTokens > 85_000) {
      return {
        level: 'warning' as const,
        persistentTokens: estimatedTokens,
        message: 'Conversation context getting large. Consider starting a new thread soon.',
        timestamp: Date.now(),
      };
    }
    if (estimatedTokens > 70_000) {
      return {
        level: 'notice' as const,
        persistentTokens: estimatedTokens,
        message: 'Conversation context is growing. Keep an eye on length.',
        timestamp: Date.now(),
      };
    }
    return null;
  }, [contextWarning, estimatedTokens]);

  // Compute planning indicator after status is defined
  useEffect(() => {
    const next = (
      status === 'streaming' &&
      !researchState.currentToolStatus &&
      !researchState.session &&
      !researchState.extractionSession &&
      !researchState.currentOperation &&
      !researchState.searchProgress
    );
    // Clear any existing timers on change
    if (planningExitRef.current) { clearTimeout(planningExitRef.current); planningExitRef.current = null; }
    if (planningRemoveRef.current) { clearTimeout(planningRemoveRef.current); planningRemoveRef.current = null; }
    if (planningShowDelayRef.current) { clearTimeout(planningShowDelayRef.current); planningShowDelayRef.current = null; }

    if (next) {
      // Defer showing by ~200ms to avoid flashing for very short gaps
      planningShowDelayRef.current = window.setTimeout(() => {
        setShowPlanningIndicator(true);
        setPlanningExiting(false);
      }, 200);
    } else if (showPlanningIndicator) {
      // Animate out gracefully
      setPlanningExiting(true);
      planningRemoveRef.current = window.setTimeout(() => {
        setShowPlanningIndicator(false);
        setPlanningExiting(false);
      }, 400);
    }
  }, [status, researchState.currentToolStatus, researchState.session, researchState.extractionSession, researchState.currentOperation, researchState.searchProgress, showPlanningIndicator]);

  // Hydrate messages on mount/thread change from local store
  useEffect(() => {
    (async () => {
      try {
        const msgs = await loadThread(threadId);
        setMessages(msgs.length ? msgs : initialMessages);
      } catch {
        setMessages(initialMessages);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Ensure any in-flight request is stopped when unmounting (thread switch/nav)
  useEffect(() => {
    return () => {
      try { stop(); } catch {}
    };
  }, [stop]);

  const {
    visibleMessages,
    hasPreviousMessages,
    showPreviousMessages,
    togglePreviousMessages,
  } = useMessageVisibility(messages as UIMessage[]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const canEdit = status === 'ready';

  const handleStartEdit = useCallback((messageId: string) => {
    if (canEdit) {
      setEditingMessageId(messageId);
    }
  }, [canEdit]);

  const handleEditSave = useCallback((messageId: string, newText: string) => {
    try {
      const trimmedText = newText.trim();
      if (!trimmedText) {
        console.warn('Cannot save empty message');
        return;
      }

      const messageIndex = messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) {
        console.warn(`Message with id ${messageId} not found`);
        return;
      }

      const originalMessage = messages[messageIndex];

      stop();

      if (originalMessage.role === 'user') {
        setMessages(prev => prev.slice(0, messageIndex));
        sendMessage({ text: trimmedText });
      } else {
        const updated = [...messages];
        updated[messageIndex] = {
          ...updated[messageIndex],
          parts: [
            {
              type: 'text' as const,
              text: trimmedText,
            },
          ],
        } as UIMessage;
        setMessages(updated);
        void saveThread(threadId, updated as UIMessage[]);
      }

      setEditingMessageId(null);
    } catch (error) {
      console.error('Error saving message edit:', error);
    }
  }, [messages, setMessages, sendMessage, stop, threadId]);

  const handleEditCancel = useCallback(() => {
    setEditingMessageId(null);
  }, []);

  // Reset research state when a new message starts
  useEffect(() => {
    if (status === 'streaming') {
      setResearchState({
        session: null,
        objectives: {},
        phases: {},
        currentOperation: null,
        searchProgress: null,
        lastError: null,
        currentToolStatus: null,
        extractionSession: null,
        extractionUrls: {},
        collections: {},
        sourcesByObjective: {},
      });
      setContextWarning(null);
      setDismissedError(false);
    }
  }, [status]);

  // Persist finalized snapshots when streaming completes
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasReady = prevStatusRef.current === 'ready';
    const isNowReady = status === 'ready';
    if (!wasReady && isNowReady && messages.length > 0) {
      void saveThread(threadId, messages as UIMessage[]);
    }
    prevStatusRef.current = status;
  }, [status, messages, threadId]);

  const handleRetry = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      const { text, files } = extractMessageContent(lastUserMessage);
      setDismissedError(false);
      stop();

      if (text && files.length > 0) {
        sendMessage({ text, files });
      } else if (text) {
        sendMessage({ text });
      } else if (files.length > 0) {
        sendMessage({ files });
      }
    }
  }, [messages, sendMessage, stop]);

  const handleDismissError = useCallback(() => {
    setDismissedError(true);
  }, []);

  const handleNewThread = useCallback(async () => {
    const newThreadId = await createThread();
    router.push(`/chat/${newThreadId}`);
  }, [router]);

  // Parse 413 errors to extract accurate token counts
  useEffect(() => {
    if (error && error.message) {
      const is413 = error.message.includes('413');
      const isContextError = error.message.toLowerCase().includes('context limit');

      if (is413 || isContextError) {
        try {
          const jsonMatch = error.message.match(/\{.*\}/);
          if (jsonMatch) {
            const errorData = JSON.parse(jsonMatch[0]);
            if (errorData.persistentTokens) {
              setContextWarning({
                level: 'critical',
                persistentTokens: errorData.persistentTokens,
                message: errorData.message || 'Conversation approaching maximum context limit.',
                timestamp: Date.now(),
              });
            }
          }
        } catch {
          if (estimatedTokens >= 100_000) {
            setContextWarning({
              level: 'critical',
              persistentTokens: estimatedTokens,
              message: 'Conversation has reached maximum context size.',
              timestamp: Date.now(),
            });
          }
        }
      }
    }
  }, [error, estimatedTokens]);

  const emptyState = (messages as UIMessage[]).length === 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Conversation className={`mx-auto w-full ${emptyState ? "max-w-[840px]" : "max-w-[840px]"} flex-1 min-h-0 px-4 md:px-6`}>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="mx-auto w-full max-w-[58rem] min-h-[60svh] grid place-items-center text-center px-3">
                <div className="w-full">
                  <h1 className="text-2xl md:text-3xl font-medium">Your bioenergetic research agent</h1>
                  <div className="mt-6 md:mt-8">
                    <ChatComposer
                      onSubmit={sendMessage}
                      status={status}
                      onStop={stop}
                      variant="hero"
                    />
                  </div>
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            <>
              {hasPreviousMessages && (
                <div className="w-full flex justify-center py-2">
                  <Button
                    onClick={togglePreviousMessages}
                    size="sm"
                    variant="outline"
                    type="button"
                    className="h-7 gap-1"
                  >
                    {showPreviousMessages ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" /> Hide previous
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" /> Show previous
                      </>
                    )}
                  </Button>
                </div>
              )}

              {visibleMessages.map((message) => (
                <Message key={message.id} from={message.role}>
                  <MessageContent
                    message={message}
                    onEdit={
                      canEdit ? () => handleStartEdit(message.id) : undefined
                    }
                  >
                    {editingMessageId === message.id ? (
                      <MessageEditForm
                        message={message}
                        onSave={(newText) =>
                          handleEditSave(message.id, newText)
                        }
                        onCancel={handleEditCancel}
                      />
                    ) : (() => {
                      const isLastAssistant =
                        message.role === 'assistant' &&
                        (visibleMessages
                          .slice()
                          .reverse()
                          .find((m) => m.role === 'assistant')?.id === message.id);
                      const aggregatedSources = (() => {
                        const all: { url: string; title?: string; domain?: string }[] = [];
                        const src = researchState.sourcesByObjective || {};
                        for (const k of Object.keys(src)) {
                          all.push(...(src[k]?.items || []));
                        }
                        return all;
                      })();
                      const uniqueSources = (() => {
                        const seen = new Set<string>();
                        const out: { url: string; title?: string; domain?: string }[] = [];
                        for (const s of aggregatedSources) {
                          const key = canonicalizeUrlForDedupe(s.url || '');
                          if (!key || seen.has(key)) continue;
                          seen.add(key);
                          out.push(s);
                        }
                        return out;
                      })();
                      if (isLastAssistant && uniqueSources.length > 0) {
                        return (
                          <>
                            <MessageRenderer message={message} />
                            <div className="mt-3">
                              <Sources>
                                <SourcesTrigger count={uniqueSources.length} />
                                <SourcesContent>
                                  <SourceList
                                    items={uniqueSources}
                                    microcopy={"All sources consulted during research for this response."}
                                  />
                                </SourcesContent>
                              </Sources>
                            </div>
                          </>
                        );
                      }
                      return <MessageRenderer message={message} />;
                    })()}
                  </MessageContent>
                </Message>
              ))}

              {/* Progress Displays */}
              {status === 'streaming' && (
                <>
                  {/* Fallback Planning Indicator (covers in-between tool calls) */}
                  {showPlanningIndicator && (
                    <ToolStatus
                      toolName={"thinkTool"}
                      action={"Planning next action"}
                      exiting={planningExiting}
                      variant="dots"
                    />
                  )}

                  {/* Lightweight status for think/memory tools */}
                  {researchState.currentToolStatus && (
                    <ToolStatus
                      toolName={researchState.currentToolStatus.toolName}
                      action={researchState.currentToolStatus.action}
                      exiting={toolStatusExiting}
                    />
                  )}

                  {/* Research Progress for executeResearchPlanTool */}
                  {researchState.session && (
                    <ResearchProgress state={researchState} />
                  )}

                  {/* Extraction Progress for targetedExtractionTool */}
                  {researchState.extractionSession && (
                    <ExtractionProgress
                      session={researchState.extractionSession}
                      urls={researchState.extractionUrls}
                    />
                  )}
                </>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && !dismissedError && (() => {
        const isContextLimitError =
          error.message?.includes('Context limit') ||
          error.message?.includes('context limit') ||
          error.message?.includes('413') ||
          estimatedTokens >= 100_000;

        if (isContextLimitError) {
          return null;
        }

        return (
          <ErrorBanner
            error={error}
            onRetry={handleRetry}
            onDismiss={handleDismissError}
          />
        );
      })()}

      {messages.length > 0 && effectiveContextWarning && (
        <div className="mx-auto w-full max-w-3xl px-3 pb-2">
          <div className={`
            relative overflow-hidden rounded-lg border backdrop-blur-sm
            transition-all duration-200
            ${effectiveContextWarning.level === 'critical'
              ? 'bg-red-50/80 border-red-200 dark:bg-red-950/40 dark:border-red-900/50'
              : effectiveContextWarning.level === 'warning'
              ? 'bg-orange-50/80 border-orange-200 dark:bg-orange-950/40 dark:border-orange-900/50'
              : 'bg-yellow-50/80 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-900/50'
            }
          `}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {effectiveContextWarning.message}
                </p>
                <p className="text-xs mt-0.5">
                  {Math.round(effectiveContextWarning.persistentTokens / 1000)}k tokens used
                </p>
              </div>
              <Button
                onClick={handleNewThread}
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
              >
                New thread
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <ChatComposer
          onSubmit={sendMessage}
          status={status}
          onStop={stop}
        />
      )}
    </div>
  );
}



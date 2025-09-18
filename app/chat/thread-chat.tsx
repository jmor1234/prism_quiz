// app/chat/thread-chat.tsx


"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { saveThread, loadThread } from "@/lib/thread-store";
import { ResearchProgress } from "@/components/research-progress";
import { ExtractionProgress } from "@/components/extraction-progress";
import { ToolStatus } from "@/components/tool-status";
import type {
  ResearchState,
  ResearchSessionData,
  ResearchObjectiveData,
  ResearchPhaseData,
  ResearchOperationData,
  SearchProgressData,
  ResearchErrorData,
} from "@/lib/streaming-types";

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
  });

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
          setResearchState((prev) => ({
            ...prev,
            currentToolStatus: data as import('@/lib/streaming-types').ToolStatusData,
          }));
          // Auto-clear after 2 seconds
          setTimeout(() => {
            setResearchState((prev) => ({
              ...prev,
              currentToolStatus: null,
            }));
          }, 2000);
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
      }
    },
  });

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
      });
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

  const emptyState = (messages as UIMessage[]).length === 0;

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Conversation className={`mx-auto w-full ${emptyState ? "max-w-[58rem]" : "max-w-3xl"} flex-1 min-h-0`}>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState>
              <div className="mx-auto w-full max-w-[58rem] min-h-[60svh] grid place-items-center text-center px-3">
                <div className="w-full">
                  <h1 className="text-2xl md:text-3xl font-medium">What are you working on?</h1>
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
                    ) : (
                      <MessageRenderer message={message} />
                    )}
                  </MessageContent>
                </Message>
              ))}

              {/* Progress Displays */}
              {status === 'streaming' && (
                <>
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

                  {/* Tool Status for simple tools */}
                  {researchState.currentToolStatus && (
                    <ToolStatus status={researchState.currentToolStatus} />
                  )}
                </>
              )}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {messages.length > 0 && (
        <ChatComposer
          onSubmit={sendMessage}
          status={status}
          onStop={stop}
        />
      )}

      {error ? (
        <div className="p-2 text-center text-xs text-red-600">{error.message}</div>
      ) : null}
    </div>
  );
}



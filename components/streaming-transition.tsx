// components/streaming-transition.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, Brain } from "lucide-react";
import type { UIMessage } from "ai";
import type { ResearchState } from "@/lib/streaming-types";

interface StreamingTransitionProps {
  isStreaming: boolean;
  hasReasoningActive: boolean;
  hasToolsActive: boolean;
  hasResponseActive: boolean;
  lastPhaseCompleted?: 'reasoning' | 'tools' | 'none';
  className?: string;
}

export function StreamingTransition({
  isStreaming,
  hasReasoningActive,
  hasToolsActive,
  hasResponseActive,
  lastPhaseCompleted = 'none',
  className
}: StreamingTransitionProps) {
  const [showTransition, setShowTransition] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState("");
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_THRESHOLD = 800; // ms before showing transition

  useEffect(() => {
    // Clear any existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Check if we're in a transition state
    const isInTransition = isStreaming &&
      !hasReasoningActive &&
      !hasToolsActive &&
      !hasResponseActive;

    if (isInTransition) {
      // Start timer to show transition UI
      inactivityTimerRef.current = setTimeout(() => {
        setShowTransition(true);

        // Set contextual message based on last completed phase
        switch (lastPhaseCompleted) {
          case 'reasoning':
            setTransitionMessage("Preparing tools...");
            break;
          case 'tools':
            setTransitionMessage("Synthesizing response...");
            break;
          default:
            setTransitionMessage("Processing...");
        }
      }, INACTIVITY_THRESHOLD);
    } else {
      // Hide transition immediately when activity resumes
      setShowTransition(false);
    }

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [isStreaming, hasReasoningActive, hasToolsActive, hasResponseActive, lastPhaseCompleted]);

  if (!showTransition) return null;

  const getIcon = () => {
    switch (lastPhaseCompleted) {
      case 'reasoning':
        return <Zap className="h-3.5 w-3.5" />;
      case 'tools':
        return <Sparkles className="h-3.5 w-3.5" />;
      default:
        return <Brain className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className={cn(
      "mx-3 my-2",
      "animate-in fade-in slide-in-from-top-1 duration-500",
      className
    )}>
      <div className="inline-flex items-center gap-2 px-3 py-1.5">
        {/* Animated icon */}
        <div className="relative">
          {getIcon()}
          <div className="absolute inset-0 bg-primary/20 blur-lg animate-pulse" />
        </div>

        {/* Message with subtle dots animation */}
        <span className="text-xs text-muted-foreground font-medium">
          {transitionMessage}
        </span>

        {/* Processing indicator */}
        <div className="flex gap-1 ml-1">
          <div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1 h-1 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

// Hook to track streaming activity state
export function useStreamingActivity(
  messages: UIMessage[],
  status: string,
  researchState: ResearchState
) {
  const [hasReasoningActive, setHasReasoningActive] = useState(false);
  const [hasResponseActive, setHasResponseActive] = useState(false);
  const [lastPhaseCompleted, setLastPhaseCompleted] = useState<'reasoning' | 'tools' | 'none'>('none');
  const lastMessageLengthRef = useRef(0);
  const lastActivityRef = useRef(Date.now());

  // Detect if tools are currently active
  const hasToolsActive = Boolean(
    researchState.session?.status === 'active' ||
    researchState.extractionSession?.status === 'active' ||
    researchState.currentToolStatus ||
    researchState.currentOperation
  );

  useEffect(() => {
    // Track reasoning activity
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.parts) {
      const hasActiveReasoning = lastMessage.parts.some(
        (part) => part.type === 'reasoning' && !(part as { completed?: boolean }).completed
      );
      setHasReasoningActive(hasActiveReasoning);

      // If reasoning just completed, mark it
      if (!hasActiveReasoning && lastMessage.parts.some((p) => p.type === 'reasoning')) {
        setLastPhaseCompleted('reasoning');
      }
    }

    // Track response streaming activity
    if (messages.length > 0) {
      const currentLength = JSON.stringify(messages).length;
      if (currentLength !== lastMessageLengthRef.current) {
        lastActivityRef.current = Date.now();
        lastMessageLengthRef.current = currentLength;

        // Check if response text is actively streaming
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.parts?.some((p) => p.type === 'text')) {
          setHasResponseActive(true);
        }
      } else if (Date.now() - lastActivityRef.current > 1000) {
        // No changes for 1s, consider response inactive
        setHasResponseActive(false);
      }
    }

    // Track tool completion
    if (!hasToolsActive && (researchState.session?.status === 'complete' ||
        researchState.extractionSession?.status === 'complete')) {
      setLastPhaseCompleted('tools');
    }
  }, [messages, hasToolsActive, researchState]);

  return {
    hasReasoningActive,
    hasToolsActive,
    hasResponseActive,
    lastPhaseCompleted
  };
}
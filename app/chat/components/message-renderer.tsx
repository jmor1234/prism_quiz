"use client";

import type { UIMessage } from "ai";
import { Response } from "@/components/ai-elements/response";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ai-elements/reasoning";

interface MessageRendererProps {
  message: UIMessage;
}

export function MessageRenderer({ message }: MessageRendererProps) {
  return (
    <>
      {message.parts.map((part, idx) => {
        switch (part.type) {
          case "text":
            return <Response key={idx}>{part.text}</Response>;
          case "reasoning":
            return (
              <Reasoning
                key={idx}
                isStreaming={part.state === "streaming"}
                defaultOpen
              >
                <ReasoningTrigger />
                <ReasoningContent>{part.text}</ReasoningContent>
              </Reasoning>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

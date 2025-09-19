"use client";

import type { UIMessage } from "ai";
import Image from "next/image";
import { Response } from "@/components/ai-elements/response";
//
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
          case "file":
            // Handle image files
            if (part.mediaType?.startsWith("image/")) {
              return (
                <div key={idx} className="my-2">
                  <Image 
                    src={part.url} 
                    alt={part.filename || "Image"} 
                    width={384} // max-w-sm equivalent (24rem = 384px)
                    height={200} // reasonable default height
                    className="max-w-sm rounded-lg border border-border/50 shadow-sm object-contain"
                    unoptimized // Required for data URLs and external images
                  />
                  {part.filename && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {part.filename}
                    </div>
                  )}
                </div>
              );
            }
            // Handle other file types (fallback)
            return (
              <div key={idx} className="my-2 text-sm text-muted-foreground">
                📎 {part.filename || "Attachment"}
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

export type MessageCopyButtonProps = ComponentProps<typeof Button> & {
  message: UIMessage;
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

const extractMessageText = (message: UIMessage): string => {
  if (!message.parts || message.parts.length === 0) {
    return "";
  }

  if (message.role === "user") {
    // For user messages, get all text parts (they typically only have text)
    const textParts = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .filter(Boolean);
    
    return textParts.join("\n\n").trim();
  }

  if (message.role === "assistant") {
    // For AI messages, extract only text parts (exclude reasoning)
    const textParts = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .filter(Boolean);
    
    return textParts.join("\n\n").trim();
  }

  return "";
};

export const MessageCopyButton = ({
  message,
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: MessageCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      const textToCopy = extractMessageText(message);
      
      if (!textToCopy.trim()) {
        onError?.(new Error("No text content to copy"));
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  const button = (
    <Button
      className={cn(
        "size-8 p-0 text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={copyToClipboard}
      size="sm"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon className="size-3.5" />}
      <span className="sr-only">{isCopied ? "Copied!" : "Copy message"}</span>
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? "Copied!" : "Copy message"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

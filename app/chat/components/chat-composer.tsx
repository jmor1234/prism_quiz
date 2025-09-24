"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { ChatStatus, FileUIPart } from "ai";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
} from "@/components/ai-elements/prompt-input";
import { VoiceButton } from "./voice-button";
import { AttachmentButton } from "./attachment-button";

interface ChatComposerProps {
  onSubmit: (message: { text: string; files?: FileUIPart[] } | { files: FileUIPart[] }) => void;
  status: ChatStatus;
  onStop: () => void;
  disabled?: boolean;
  variant?: "default" | "hero";
}

export function ChatComposer({ onSubmit, status, onStop, disabled, variant = "default" }: ChatComposerProps) {
  const handleTranscription = useCallback((text: string) => {
    // Find the textarea within this component's form
    const textarea = document.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
    if (textarea) {
      const currentValue = textarea.value;
      const newValue = currentValue ? `${currentValue} ${text}` : text;
      textarea.value = newValue;
      
      // Trigger input event to update any React state
      const event = new Event('input', { bubbles: true });
      textarea.dispatchEvent(event);
      
      // Focus the textarea
      textarea.focus();
    }
  }, []);

  const handleSubmit = useCallback(({ text, files }: { text?: string; files?: FileUIPart[] }, event: React.FormEvent<HTMLFormElement>) => {
    const trimmed = text?.trim();
    if (trimmed) {
      onSubmit({ text: trimmed, files });
    } else if (files && files.length > 0) {
      onSubmit({ files });
    }
    // Clear the composer after submitting
    event.currentTarget.reset();
  }, [onSubmit]);

  const handleStopClick = useCallback((e: React.MouseEvent) => {
    if (status === "streaming") {
      e.preventDefault();
      onStop();
    }
  }, [status, onStop]);

  const isHero = variant === "hero";

  const containerClasses = isHero
    ? "mx-auto w-full max-w-[52rem] px-3 py-0"
    : "mx-auto w-full max-w-3xl px-3 py-3";

  return (
    <div className={containerClasses}>
      <PromptInput
        className={cn(
          "border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          isHero
            ? "border-black/15 shadow-md dark:border-white/10 dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-white/5"
            : "border-border/60 shadow-sm"
        )}
        multiple
        accept="image/*,application/pdf,text/*"
        onSubmit={handleSubmit}
      >
        <PromptInputAttachments>
          {(attachment) => (
            <PromptInputAttachment key={attachment.id} data={attachment} />
          )}
        </PromptInputAttachments>
        <div className="flex items-center gap-3 px-4 py-2">
          <AttachmentButton disabled={disabled} />
          <div className="flex-1">
            <PromptInputTextarea
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 md:text-base"
              placeholder={isHero ? "Ask anything" : "Message…"}
              rows={1}
            />
          </div>
          <VoiceButton 
            onTranscriptionComplete={handleTranscription}
            disabled={disabled}
          />
          <PromptInputSubmit
            className={
              isHero
                ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                : "bg-foreground text-background hover:bg-foreground/90"
            }
            variant="default"
            status={status}
            onClick={handleStopClick}
          />
        </div>
      </PromptInput>
    </div>
  );
}

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
  PromptInputToolbar,
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
    // Block submission during streaming
    if (status === "streaming") {
      event.preventDefault();
      return;
    }

    const trimmed = text?.trim();
    if (trimmed) {
      onSubmit({ text: trimmed, files });
    } else if (files && files.length > 0) {
      onSubmit({ files });
    }
    // Clear the composer after submitting
    event.currentTarget.reset();
  }, [onSubmit, status]);

  const handleStopClick = useCallback((e: React.MouseEvent) => {
    if (status === "streaming") {
      e.preventDefault();
      onStop();
    }
  }, [status, onStop]);

  const isHero = variant === "hero";

  const containerClasses = isHero
    ? "fixed left-0 right-0 bottom-0 z-30 w-screen px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:sticky md:bottom-0 md:left-auto md:right-auto md:z-30 md:w-full md:mx-auto md:px-3 md:py-3 md:max-w-[var(--container-max-w)]"
    : "mx-auto w-full px-3 py-3 md:max-w-3xl";

  return (
    <div className={containerClasses}>
      <PromptInput
        className={cn(
          "border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          isHero
            ? "rounded-xl border-black/15 shadow-md dark:rounded-xl dark:border-white/10 dark:shadow-sm dark:ring-1 dark:ring-inset dark:ring-white/5 md:rounded-xl md:border-border/60 md:dark:ring-0 md:border-t md:shadow-[0_-8px_24px_-12px_hsl(var(--border))]"
            : "rounded-xl border-border/60 shadow-sm"
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
        {isHero ? (
          <>
            <div className="px-4 pt-2">
              <PromptInputTextarea
                className="min-h-0 max-h-[40svh] resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 md:text-base"
                placeholder="Ask about symptoms, conditions, or health connections..."
                rows={1}
                data-status={status}
              />
            </div>
            <PromptInputToolbar className="flex items-center justify-between px-2 pb-2 pt-1">
              <div className="flex items-center gap-1">
                <AttachmentButton disabled={disabled} />
                <VoiceButton
                  onTranscriptionComplete={handleTranscription}
                  disabled={disabled}
                />
              </div>
              <PromptInputSubmit
                className="h-9 rounded-lg bg-foreground px-4 text-background hover:bg-foreground/90"
                variant="default"
                status={status}
                onClick={handleStopClick}
                disabled={disabled}
              />
            </PromptInputToolbar>
          </>
        ) : (
          <div className="flex items-center gap-3 px-4 py-2">
            <AttachmentButton disabled={disabled} />
            <div className="flex-1 min-w-0">
              <PromptInputTextarea
                className="min-h-0 resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 md:text-base"
                placeholder="Continue exploring..."
                rows={1}
                data-status={status}
              />
            </div>
            <VoiceButton
              onTranscriptionComplete={handleTranscription}
              disabled={disabled}
            />
            <PromptInputSubmit
              className="bg-foreground text-background hover:bg-foreground/90"
              variant="default"
              status={status}
              onClick={handleStopClick}
              disabled={disabled}
            />
          </div>
        )}
      </PromptInput>
    </div>
  );
}

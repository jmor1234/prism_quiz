"use client";

import { useCallback } from "react";
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
}

export function ChatComposer({ onSubmit, status, onStop, disabled }: ChatComposerProps) {
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

  return (
    <div className="mx-auto w-full max-w-2xl px-3 py-3">
      <PromptInput
        className="border-muted/30 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60"
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
              className="min-h-0 resize-none border-0 bg-transparent p-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 md:text-sm"
              placeholder="Message..."
              rows={1}
            />
          </div>
          <VoiceButton 
            onTranscriptionComplete={handleTranscription}
            disabled={disabled}
          />
          <PromptInputSubmit
            className="bg-foreground text-background hover:bg-foreground/90"
            status={status}
            onClick={handleStopClick}
          />
        </div>
      </PromptInput>
    </div>
  );
}

"use client";

import { PlusIcon } from "lucide-react";
import { PromptInputButton, usePromptInputAttachments } from "@/components/ai-elements/prompt-input";

interface AttachmentButtonProps {
  disabled?: boolean;
}

export function AttachmentButton({ disabled }: AttachmentButtonProps) {
  const attachments = usePromptInputAttachments();
  
  return (
    <PromptInputButton
      onClick={attachments.openFileDialog}
      disabled={disabled}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      aria-label="Add attachments"
    >
      <PlusIcon className="h-4 w-4" />
    </PromptInputButton>
  );
}

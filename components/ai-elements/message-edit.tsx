"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { extractMessageText } from "@/lib/message-utils";
import type { UIMessage } from "ai";
import { EditIcon, CheckIcon, XIcon } from "lucide-react";
import type { ComponentProps, KeyboardEvent } from "react";
import { useState, useEffect, useRef, useCallback } from "react";

export type MessageEditButtonProps = ComponentProps<typeof Button> & {
  message: UIMessage;
  onEdit: () => void;
};

export const MessageEditButton = ({
  onEdit,
  className,
  ...props
}: MessageEditButtonProps) => {
  const button = (
    <Button
      className={cn(
        "size-8 p-0 text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={onEdit}
      size="sm"
      variant="ghost"
      {...props}
    >
      <EditIcon className="size-3.5" />
      <span className="sr-only">Edit message</span>
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>Edit message</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export type MessageEditFormProps = {
  message: UIMessage;
  onSave: (newText: string) => void;
  onCancel: () => void;
};

export const MessageEditForm = ({
  message,
  onSave,
  onCancel,
}: MessageEditFormProps) => {
  const [text, setText] = useState(extractMessageText(message));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus and select text when component mounts
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, []);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to measure content
    textarea.style.height = 'auto';
    // Set height to scrollHeight, bounded by min/max
    const newHeight = Math.max(60, Math.min(300, textarea.scrollHeight));
    textarea.style.height = `${newHeight}px`;
  }, [text]);

  const handleSave = useCallback(() => {
    const trimmedText = text.trim();
    if (trimmedText && trimmedText !== extractMessageText(message)) {
      onSave(trimmedText);
    } else {
      onCancel();
    }
  }, [text, message, onSave, onCancel]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [handleSave, onCancel]);

  return (
    <div className="space-y-3" role="form" aria-label="Edit message form">
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[60px] resize-none"
        placeholder="Edit your message..."
        aria-label="Edit message content"
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          onClick={handleSave}
          size="sm"
          disabled={!text.trim()}
          className="h-8"
          aria-label="Save changes to message"
        >
          <CheckIcon className="size-3.5 mr-1" />
          Save
        </Button>
        <Button
          onClick={onCancel}
          size="sm"
          variant="outline"
          className="h-8"
          aria-label="Cancel editing and discard changes"
        >
          <XIcon className="size-3.5 mr-1" />
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground ml-auto" aria-hidden="true">
          Ctrl+Enter to save • Esc to cancel
        </span>
      </div>
    </div>
  );
};

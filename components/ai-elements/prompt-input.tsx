"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChatStatus } from "ai";
import {
  Loader2Icon,
  SendIcon,
  SquareIcon,
} from "lucide-react";
import {
  type ComponentProps,
  type FormEvent,
  type FormEventHandler,
  type HTMLAttributes,
  type KeyboardEventHandler,
  useRef,
  useEffect,
} from "react";

// ===== Main Form Wrapper =====

export const PromptInput = ({
  className,
  onSubmit,
  ...props
}: Omit<HTMLAttributes<HTMLFormElement>, "onSubmit"> & {
  onSubmit: (
    message: { text?: string },
    event: FormEvent<HTMLFormElement>
  ) => void;
}) => {
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const text = (formEl.elements.namedItem("message") as HTMLTextAreaElement)
      ?.value;
    onSubmit({ text }, event);
    formEl.reset();
  };

  return (
    <form
      ref={formRef}
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-background shadow-sm",
        className
      )}
      onSubmit={handleSubmit}
      {...props}
    >
      {props.children}
    </form>
  );
};

// ===== Textarea =====

export const PromptInputTextarea = ({
  className,
  placeholder = "Ask anything\u2026",
  ...props
}: ComponentProps<typeof Textarea>) => {
  const status = (props as Record<string, unknown>)["data-status"] as string | undefined;
  const isDisabled = status === "streaming" || status === "submitted";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let supportsFieldSizing = false;
    try {
      supportsFieldSizing =
        typeof CSS !== "undefined" && CSS.supports("field-sizing: content");
    } catch {
      /* ignore */
    }
    if (supportsFieldSizing) return;

    const autosize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };
    autosize();
    el.addEventListener("input", autosize);
    const form = el.form;
    const handleReset = () => requestAnimationFrame(autosize);
    if (form) form.addEventListener("reset", handleReset);
    return () => {
      el.removeEventListener("input", autosize);
      if (form) form.removeEventListener("reset", handleReset);
    };
  }, []);

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      if (e.shiftKey) return;
      if (e.currentTarget.dataset.status === "streaming") {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <Textarea
      ref={textareaRef}
      className={cn(
        "w-full resize-none rounded-none border-none p-3 shadow-none ring-0",
        "field-sizing-content bg-transparent dark:bg-transparent",
        "max-h-[40svh] min-h-0",
        "focus-visible:ring-0 focus-visible:outline-none focus-visible:border-primary/30",
        className
      )}
      name="message"
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={1}
      {...props}
      disabled={isDisabled}
    />
  );
};

// ===== Layout Primitives =====

export const PromptInputToolbar = ({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex items-center justify-between p-1", className)}
    {...props}
  />
);

// ===== Submit Button =====

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon",
  status,
  children,
  ...props
}: ComponentProps<typeof Button> & { status?: ChatStatus }) => {
  let Icon = <SendIcon className="size-4" />;
  if (status === "submitted")
    Icon = <Loader2Icon className="size-4 motion-safe:animate-spin" />;
  else if (status === "streaming")
    Icon = <SquareIcon className="size-4" />;

  const buttonType = status === "streaming" ? "button" : "submit";

  return (
    <Button
      className={cn(
        "gap-1.5 rounded-lg",
        status === "streaming" && "!bg-red-500 hover:!bg-red-600 text-white",
        className
      )}
      size={size}
      type={buttonType}
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </Button>
  );
};

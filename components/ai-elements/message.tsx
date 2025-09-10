import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps, HTMLAttributes } from "react";
import { MessageCopyButton } from "./message-copy";
import { MessageEditButton } from "./message-edit";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2",
      // User messages: Keep standard padding
      from === "user" ? "is-user py-4" : "is-assistant flex-row-reverse justify-end py-6",
      className
    )}
    {...props}
  />
);

const messageContentVariants = cva(
  "flex flex-col gap-2 overflow-hidden text-sm",
  {
    variants: {
      variant: {
        contained: [
          // User messages: Keep bubble styling
          "group-[.is-user]:max-w-[80%] group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:rounded-2xl",
          "group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
          // Assistant messages: No background, document-style
          "group-[.is-assistant]:bg-transparent group-[.is-assistant]:text-foreground group-[.is-assistant]:px-0 group-[.is-assistant]:py-0",
        ],
        flat: [
          "group-[.is-user]:max-w-[80%] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground group-[.is-user]:rounded-2xl",
          "group-[.is-assistant]:bg-transparent group-[.is-assistant]:text-foreground group-[.is-assistant]:px-0 group-[.is-assistant]:py-0",
        ],
      },
    },
    defaultVariants: {
      variant: "contained",
    },
  }
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof messageContentVariants> & {
  message?: UIMessage;
  onEdit?: () => void;
};

export const MessageContent = ({
  children,
  className,
  variant,
  message,
  onEdit,
  ...props
}: MessageContentProps) => (
  <div className="relative flex items-start gap-2">
    <div
      className={cn(messageContentVariants({ variant, className }))}
      {...props}
    >
      {children}
    </div>
    {message && (
      <div className="opacity-0 transition-opacity group-hover:opacity-100 mt-2 flex-shrink-0 flex items-center gap-1">
        {message.role === 'user' && onEdit && (
          <MessageEditButton message={message} onEdit={onEdit} />
        )}
        <MessageCopyButton message={message} />
      </div>
    )}
  </div>
);

export type MessageAvatarProps = ComponentProps<typeof Avatar> & {
  src: string;
  name?: string;
};

export const MessageAvatar = ({
  src,
  name,
  className,
  ...props
}: MessageAvatarProps) => (
  <Avatar className={cn("size-8 ring-1 ring-border", className)} {...props}>
    <AvatarImage alt="" className="mt-0 mb-0" src={src} />
    <AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
  </Avatar>
);

"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BookIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useState } from "react";

export type SourcesProps = ComponentProps<"div">;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn("not-prose mb-4 text-primary text-xs", className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    {children ?? (
      <>
        <p className="font-medium tabular-nums">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-3 flex w-fit flex-col gap-2",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<"a">;

export const Source = ({ href, title, children, ...props }: SourceProps) => (
  <a
    className="flex items-center gap-2"
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <BookIcon className="h-4 w-4" />
        <span className="block font-medium">{title}</span>
      </>
    )}
  </a>
);

// New: Typed item shape for curated sources
export type SourceListItemData = { url: string; title?: string; domain?: string };

export type SourceListItemProps = SourceListItemData & { className?: string };

// Renders favicon + [Title](URL) with robust a11y and hit target ≥24px
export const SourceListItem = ({ url, title, domain, className }: SourceListItemProps) => {
  let parsedDomain = domain;
  if (!parsedDomain) {
    try { parsedDomain = new URL(url).hostname.replace(/^www\./, ""); } catch {}
  }
  const label = (title && title.trim().length > 0) ? title.trim() : (parsedDomain || url);
  const aria = title ? `${title}${parsedDomain ? ` — ${parsedDomain}` : ""}` : (parsedDomain || url);
  const favicon = parsedDomain ? `https://icons.duckduckgo.com/ip3/${parsedDomain}.ico` : undefined;

  return (
    <li className={cn("list-none", className)}>
      <a
        href={url}
        rel="noopener noreferrer"
        target="_blank"
        className={cn(
          "group flex items-center gap-2 min-h-6 -mx-1.5 px-1.5 rounded-md",
          "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        )}
        aria-label={aria}
        title={title ? `${title} — ${url}` : url}
      >
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon}
            alt=""
            aria-hidden="true"
            width={14}
            height={14}
            className="h-[14px] w-[14px] rounded-sm"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <BookIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <span className="truncate">{label}</span>
        {parsedDomain && (
          <span className="ml-1 hidden truncate text-muted-foreground/70 sm:inline">({parsedDomain})</span>
        )}
      </a>
    </li>
  );
};

export type SourceListProps = ComponentProps<"div"> & {
  items: SourceListItemData[];
  initialCount?: number;
};

// Simple capped list with optional Show all expansion; semantic ul/li structure
export const SourceList = ({ items, initialCount = 8, className, ...props }: SourceListProps) => {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);

  return (
    <div className={cn("w-full", className)} {...props}>
      <ul className="space-y-1">
        {visible.map((s, i) => (
          <SourceListItem key={`${s.url}-${i}`} url={s.url} title={s.title} domain={s.domain} />
        ))}
      </ul>
      {items.length > initialCount && !expanded && (
        <button
          type="button"
          className="mt-1 text-[11px] text-primary underline-offset-2 hover:underline"
          onClick={() => setExpanded(true)}
        >
          Show all
        </button>
      )}
    </div>
  );
};

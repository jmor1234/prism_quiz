"use client";

import { cn } from "@/lib/utils";

export function SectionTitle({ state, children, count }: { state: 'muted' | 'active' | 'done'; children: React.ReactNode; count?: number }) {
  const dot = state === 'active' ? 'bg-primary ring-2 ring-ring' : state === 'done' ? 'bg-primary' : 'bg-muted-foreground';
  return (
    <div className="flex items-center gap-2">
      <span className={cn("rounded-full", "inline-block", "size-2.5", dot)} />
      <span className="text-sm font-medium text-muted-foreground">{children}</span>
      {typeof count === 'number' && (
        <span className="text-xs text-muted-foreground opacity-70">· {count}</span>
      )}
    </div>
  );
}

export function QueryChip({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground max-w-[220px] truncate"
      title={text}
    >
      {text}
    </span>
  );
}

export function SourceRow({ title, url, site }: { title: string; url: string; site?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:bg-muted"
      title={title || url}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-5 rounded-sm bg-muted ring-1 ring-border" />
        <div className="text-sm leading-5 min-w-0">
          <div className="font-medium group-hover:underline truncate">{title || url}</div>
          <div className="text-xs text-muted-foreground truncate">{url}</div>
        </div>
      </div>
      {site && <span className="text-xs text-muted-foreground shrink-0">{site}</span>}
    </a>
  );
}



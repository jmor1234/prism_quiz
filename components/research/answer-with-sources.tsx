"use client";

import { useMemo, useState } from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { MessageRenderer } from "@/app/chat/components/message-renderer";

export interface SourceItem {
  url: string;
  title?: string;
  domain?: string;
}

interface AnswerWithSourcesTabsProps {
  message: UIMessage;
  sources: SourceItem[];
}

export function AnswerWithSourcesTabs({ message, sources }: AnswerWithSourcesTabsProps) {
  const [active, setActive] = useState<'answer' | 'sources'>('answer');
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    const out: SourceItem[] = [];
    for (const s of sources) {
      const key = s.url || s.domain || s.title || Math.random().toString(36);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  }, [sources]);

  const showSourcesTab = uniqueSources.length > 0;

  return (
    <div className="w-full">
      <div className="w-full border-b border-border bg-transparent p-0 mb-2">
        <div className="flex items-end gap-6">
          <button
            type="button"
            onClick={() => setActive('answer')}
            className={cn(
              "rounded-none bg-transparent px-0 pb-3 text-sm",
              active === 'answer' ? "text-foreground border-b-2 border-primary" : "text-muted-foreground border-b-2 border-transparent"
            )}
          >
            Answer
          </button>
          {showSourcesTab && (
            <button
              type="button"
              onClick={() => setActive('sources')}
              className={cn(
                "rounded-none bg-transparent px-0 pb-3 text-sm",
                active === 'sources' ? "text-foreground border-b-2 border-primary" : "text-muted-foreground border-b-2 border-transparent"
              )}
            >
              Sources
            </button>
          )}
        </div>
      </div>

      {active === 'answer' ? (
        // Reuse existing renderer for full fidelity (markdown + reasoning parts)
        <MessageRenderer message={message} />
      ) : (
        <div className="space-y-1.5">
          {uniqueSources.map((s, i) => (
            <a
              key={`${s.url}-${i}`}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:bg-muted"
              title={s.title || s.url}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-5 rounded-sm bg-muted ring-1 ring-border" />
                <div className="text-sm leading-5 min-w-0">
                  <div className="font-medium group-hover:underline truncate">
                    {s.title || s.url}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{s.url}</div>
                </div>
              </div>
              {s.domain && (
                <span className="text-xs text-muted-foreground shrink-0">{s.domain}</span>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default AnswerWithSourcesTabs;



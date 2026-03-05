"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  listThreads,
  renameThread,
  deleteThread,
  type ThreadMeta,
} from "@/lib/chat/thread-store";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatSidebar({
  activeThreadId,
  onSelectThread,
  pathname,
}: {
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  pathname: string;
}) {
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const refreshThreads = useCallback(async () => {
    const list = await listThreads();
    setThreads(list);
  }, []);

  // Refresh on mount and on pathname change (thread switch)
  useEffect(() => {
    refreshThreads();
  }, [pathname, refreshThreads]);

  const handleRename = useCallback(
    async (id: string) => {
      const trimmed = editValue.trim();
      if (trimmed) {
        await renameThread(id, trimmed);
        await refreshThreads();
      }
      setEditingId(null);
    },
    [editValue, refreshThreads]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this conversation?")) return;
      await deleteThread(id);
      await refreshThreads();
      // If we deleted the active thread, select the first remaining
      if (id === activeThreadId) {
        const remaining = await listThreads();
        if (remaining.length > 0) {
          onSelectThread(remaining[0].id);
        }
      }
    },
    [activeThreadId, onSelectThread, refreshThreads]
  );

  const startEditing = useCallback((thread: ThreadMeta) => {
    setEditingId(thread.id);
    setEditValue(thread.title);
    setTimeout(() => editInputRef.current?.focus(), 0);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
      {threads.map((thread) => {
        const isActive = thread.id === activeThreadId;
        const isEditing = thread.id === editingId;

        return (
          <div
            key={thread.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-muted font-medium"
                : "hover:bg-muted/50 text-muted-foreground"
            )}
          >
            {isEditing ? (
              <form
                className="flex items-center gap-1 flex-1 min-w-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRename(thread.id);
                }}
              >
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleRename(thread.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="flex-1 min-w-0 bg-transparent border-b border-border text-sm outline-none"
                />
                <button
                  type="submit"
                  className="p-0.5 rounded hover:bg-muted"
                  aria-label="Save"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-0.5 rounded hover:bg-muted"
                  aria-label="Cancel"
                >
                  <X className="h-3 w-3" />
                </button>
              </form>
            ) : (
              <>
                <button
                  onClick={() => onSelectThread(thread.id)}
                  className="flex-1 min-w-0 text-left truncate"
                >
                  {thread.title}
                </button>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEditing(thread);
                    }}
                    className="p-1 rounded hover:bg-background"
                    aria-label="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(thread.id);
                    }}
                    className="p-1 rounded hover:bg-background text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {threads.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No conversations yet
        </p>
      )}
    </div>
  );
}

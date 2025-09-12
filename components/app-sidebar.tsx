"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { Plus, MessageSquare, MoreHorizontal } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModeToggle } from "@/components/ui/mode-toggle";
import type { ThreadMeta } from "@/lib/thread-store";
import { createThread, listThreads, renameThread, deleteThread } from "@/lib/thread-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuAction, SidebarInput } from "@/components/ui/sidebar";

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const activeId = (params?.threadId as string) || null;

  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const refresh = React.useCallback(async () => {
    const list = await listThreads();
    setThreads(list);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const handleNewChat = React.useCallback(async () => {
    const id = await createThread();
    await refresh();
    router.push(`/chat/${id}`);
  }, [refresh, router]);

  const items = useMemo(() => threads, [threads]);

  async function commitRename(id: string, title: string) {
    const trimmed = title.trim();
    setEditingId(null);
    if (!trimmed) return;
    await renameThread(id, trimmed);
    await refresh();
  }

  async function handleDelete(id: string) {
    const confirmDelete = window.confirm("Delete this thread? This cannot be undone.");
    if (!confirmDelete) return;
    await deleteThread(id);
    const list = await listThreads();
    if (list.length > 0) {
      router.push(`/chat/${list[0].id}`);
      setThreads(list);
    } else {
      const newId = await createThread();
      const updated = await listThreads();
      setThreads(updated);
      router.push(`/chat/${newId}`);
    }
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-0">
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <MessageSquare className="opacity-70" /> Threads
          </SidebarGroupLabel>
          <SidebarGroupAction title="New chat" onClick={handleNewChat}>
            <Plus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <ScrollArea className="h-[calc(100svh-10rem)] pr-1">
              <SidebarMenu>
                {items.map((t) => (
                  <SidebarMenuItem key={t.id}>
                    {editingId === t.id ? (
                      <div className="flex items-center gap-2">
                        <SidebarInput
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              void commitRename(t.id, editingTitle);
                            } else if (e.key === "Escape") {
                              setEditingId(null);
                            }
                          }}
                          onBlur={() => void commitRename(t.id, editingTitle)}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <SidebarMenuButton
                          asChild
                          isActive={activeId === t.id}
                          tooltip={t.title}
                        >
                          <a onClick={() => router.push(`/chat/${t.id}`)}>
                            <MessageSquare />
                            <span>{t.title || t.id}</span>
                          </a>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuAction showOnHover>
                              <MoreHorizontal />
                            </SidebarMenuAction>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" align="start">
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setEditingId(t.id);
                                setEditingTitle(t.title || "");
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                void handleDelete(t.id);
                              }}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </ScrollArea>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}



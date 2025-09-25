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
import { createThread, listThreads, renameThread, deleteThread, deleteAllThreads } from "@/lib/thread-store";
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

  async function handleDeleteAll() {
    const confirmDelete = window.confirm("Delete ALL chats? This cannot be undone.");
    if (!confirmDelete) return;
    await deleteAllThreads();
    const newId = await createThread();
    const updated = await listThreads();
    setThreads(updated);
    router.push(`/chat/${newId}`);
  }

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className="border-0">
      <SidebarHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium group-data-[collapsible=icon]:hidden">Bioenergetic</span>
          </div>
          <div className="flex group-data-[collapsible=icon]:justify-center">
            <ModeToggle />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <MessageSquare className="opacity-70" /> Threads
          </SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarGroupAction
                title="Actions"
                className="right-2 top-2 h-6 w-6 rounded-full border border-sidebar-border/40 bg-transparent text-muted-foreground hover:border-sidebar-border/60 hover:bg-transparent hover:text-foreground focus-visible:ring-0"
              >
                <Plus className="h-3.5 w-3.5" />
              </SidebarGroupAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  void handleNewChat();
                }}
              >
                New chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onSelect={(e) => {
                  e.preventDefault();
                  void handleDeleteAll();
                }}
              >
                Delete all chats
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
                            <SidebarMenuAction showOnHover aria-label="More actions">
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



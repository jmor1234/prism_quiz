"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, LogOut, RefreshCw, Loader2, Download, Search, X, FileDown, Calendar, MessageSquare, Sparkles, MessagesSquare } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Response } from "@/components/ai-elements/response";
import { cn } from "@/lib/utils";
import { getVariant, getAllVariants } from "@/lib/quiz/variants";
import { isOtherValue, getOtherText } from "@/lib/quiz/otherOption";
import type { QuestionConfig, YesNoWithFollowUp } from "@/lib/quiz/types";

// ============================================================================
// Types
// ============================================================================

interface EngagementEvent {
  type: "pdf_download" | "booking_click" | "agent_opened";
  source: "assessment" | "agent";
  timestamp: string;
}

interface SerializedMessage {
  role: "user" | "assistant";
  text: string;
}

interface EngagementRecord {
  quizId: string;
  events: EngagementEvent[];
  conversation: SerializedMessage[] | null;
  summary: string | null;
  updatedAt: string;
}

interface QuizEntry {
  id: string;
  createdAt: string;
  variant: string;
  name: string;
  answers: Record<string, unknown>;
  report: string | null;
  engagement: EngagementRecord | null;
}

interface ChatSession {
  threadId: string;
  conversation: SerializedMessage[] | null;
  summary: string | null;
  events: { type: string; source: string; timestamp: string }[];
  createdAt: string;
  updatedAt: string;
}

type AdminTab = "quiz" | "chat";
type AuthState = "checking" | "unauthenticated" | "authenticated";

// ============================================================================
// Helper Functions
// ============================================================================

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(isoString: string): string {
  return dateFormatter.format(new Date(isoString));
}

// ============================================================================
// Sub-components
// ============================================================================

function YesNoIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[13px] text-foreground/80">{label}</span>
      <span
        className={cn(
          "text-[13px] font-semibold tracking-tight",
          value
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-500 dark:text-red-400"
        )}
      >
        {value ? "Yes" : "No"}
      </span>
    </div>
  );
}

function SliderValue({ level, max = 10 }: { level: number; max?: number }) {
  const safeLevel = level ?? 0;
  const getColor = (l: number) => {
    const ratio = l / max;
    if (ratio <= 0.3) return "text-amber-600 dark:text-amber-400";
    if (ratio <= 0.6) return "text-yellow-600 dark:text-yellow-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("text-2xl font-bold tabular-nums tracking-tight", getColor(safeLevel))}>
        {safeLevel}
      </span>
      <span className="text-sm text-foreground/40 font-medium">/{max}</span>
    </div>
  );
}

function AnswerField({ question, value }: { question: QuestionConfig; value: unknown }) {
  const label = question.promptLabel ?? question.question;

  switch (question.type) {
    case "slider":
      return (
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide mb-1">
            {label}
          </span>
          <SliderValue level={value as number} max={question.max} />
        </div>
      );

    case "yes_no": {
      if (question.conditionalFollowUp) {
        // Handle both compound { answer, followUp } and plain boolean (legacy edge case)
        const compound = typeof value === "boolean"
          ? { answer: value, followUp: [] }
          : (value as YesNoWithFollowUp | undefined);
        const answered = compound?.answer === true;
        const followUp = compound?.followUp ?? [];
        return (
          <div>
            <YesNoIndicator label={label} value={answered} />
            {answered && followUp.length > 0 && (
              <div className="flex items-baseline gap-2 pl-2 pb-1">
                <span className="text-xs text-foreground/50">→</span>
                <span className="text-xs text-foreground/70">
                  {followUp.map((v) => {
                    const opt = question.conditionalFollowUp!.options.find((o) => o.value === v);
                    return opt ? opt.label : v;
                  }).join(", ")}
                </span>
              </div>
            )}
          </div>
        );
      }
      return <YesNoIndicator label={label} value={value as boolean} />;
    }

    case "multi_select": {
      const selected = (value ?? []) as string[];
      return (
        <div className="flex items-baseline gap-2 py-1.5 border-b border-border/40 last:border-0">
          <span className="text-[13px] text-foreground/80 shrink-0">{label}</span>
          <span className="text-[13px] font-medium text-foreground">
            {selected.length > 0
              ? selected.map((v) => {
                  if (isOtherValue(v)) return `Other: ${getOtherText(v)}`;
                  const opt = question.options.find((o) => o.value === v);
                  return opt ? opt.label : v;
                }).join(", ")
              : "None"}
          </span>
        </div>
      );
    }

    case "single_select": {
      const displayValue = typeof value === "string" && isOtherValue(value)
        ? `Other: ${getOtherText(value)}`
        : (() => { const opt = question.options.find((o) => o.value === value); return opt ? opt.label : String(value ?? ""); })();
      return (
        <div className="flex items-baseline gap-2 py-1.5 border-b border-border/40 last:border-0">
          <span className="text-[13px] text-foreground/80 shrink-0">{label}</span>
          <span className="text-[13px] font-medium text-foreground">
            {displayValue}
          </span>
        </div>
      );
    }

    case "free_text":
      return (
        <div>
          <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider block mb-1.5">
            {label}
          </span>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {String(value ?? "")}
          </p>
        </div>
      );
  }
}

function QuizAnswersDisplay({ variant, answers }: { variant: string; answers: Record<string, unknown> }) {
  const config = getVariant(variant);

  // Fallback for unknown/removed variants
  if (!config) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h4 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">Quiz Answers</h4>
          <div className="flex-1 h-px bg-border/60" />
        </div>
        <p className="text-xs text-muted-foreground italic">Unknown variant &ldquo;{variant}&rdquo; — showing raw answers</p>
        {Object.entries(answers).map(([key, val]) => (
          <div key={key} className="flex gap-2 text-sm">
            <span className="font-medium text-foreground/60">{key}:</span>
            <span className="text-foreground">{typeof val === "object" ? JSON.stringify(val) : String(val)}</span>
          </div>
        ))}
      </div>
    );
  }

  const sliders = config.questions.filter((q) => q.type === "slider");
  const yesNos = config.questions.filter((q) => q.type === "yes_no");
  const selects = config.questions.filter((q) => q.type === "multi_select" || q.type === "single_select");
  const freeTexts = config.questions.filter((q) => q.type === "free_text");

  // Split yes/no into two columns
  const midpoint = Math.ceil(yesNos.length / 2);
  const yesNoCol1 = yesNos.slice(0, midpoint);
  const yesNoCol2 = yesNos.slice(midpoint);

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h4 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">Quiz Answers</h4>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Sliders + Yes/No grid */}
      <div className={cn(
        "grid grid-cols-1 gap-6",
        sliders.length > 0 ? "md:grid-cols-[140px_1fr_1fr]" : "md:grid-cols-2"
      )}>
        {sliders.map((q) => (
          <AnswerField key={q.id} question={q} value={answers[q.id]} />
        ))}
        {yesNoCol1.length > 0 && (
          <div className="bg-card/50 dark:bg-card/30 rounded-md px-3 py-0.5 border border-border/40">
            {yesNoCol1.map((q) => (
              <AnswerField key={q.id} question={q} value={answers[q.id]} />
            ))}
          </div>
        )}
        {yesNoCol2.length > 0 && (
          <div className="bg-card/50 dark:bg-card/30 rounded-md px-3 py-0.5 border border-border/40">
            {yesNoCol2.map((q) => (
              <AnswerField key={q.id} question={q} value={answers[q.id]} />
            ))}
          </div>
        )}
      </div>

      {/* Select questions */}
      {selects.length > 0 && (
        <div className="bg-card/50 dark:bg-card/30 rounded-md px-3 py-0.5 border border-border/40">
          {selects.map((q) => (
            <AnswerField key={q.id} question={q} value={answers[q.id]} />
          ))}
        </div>
      )}

      {/* Free text answers */}
      {freeTexts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
          {freeTexts.map((q) => (
            <AnswerField key={q.id} question={q} value={answers[q.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

const EVENT_LABELS: Record<string, string> = {
  pdf_download: "PDF",
  booking_click: "Booking link clicked",
  agent_opened: "Chat",
};

function EngagementBadges({ engagement }: { engagement: EngagementRecord | null }) {
  if (!engagement) return null;

  const hasPdf = engagement.events.some((e) => e.type === "pdf_download");
  const bookingFromAssessment = engagement.events.some(
    (e) => e.type === "booking_click" && e.source === "assessment"
  );
  const bookingFromAgent = engagement.events.some(
    (e) => e.type === "booking_click" && e.source === "agent"
  );
  const hasChat = engagement.conversation && engagement.conversation.length > 0;
  const messageCount = engagement.conversation?.length ?? 0;

  if (!hasPdf && !bookingFromAssessment && !bookingFromAgent && !hasChat) return null;

  return (
    <span className="flex items-center gap-1.5">
      {hasPdf && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          <FileDown className="h-3 w-3" />
          PDF
        </span>
      )}
      {bookingFromAssessment && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Calendar className="h-3 w-3" />
          Booking clicked via assessment
        </span>
      )}
      {bookingFromAgent && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          <Calendar className="h-3 w-3" />
          Booking clicked via chat
        </span>
      )}
      {hasChat && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          <MessageSquare className="h-3 w-3" />
          {messageCount} msgs
        </span>
      )}
    </span>
  );
}

function EngagementSection({
  engagement,
  onGenerateSummary,
  isSummarizing,
}: {
  engagement: EngagementRecord | null;
  onGenerateSummary: () => void;
  isSummarizing: boolean;
}) {
  if (!engagement) return null;

  const hasEvents = engagement.events.length > 0;
  const hasConversation = engagement.conversation && engagement.conversation.length > 0;

  if (!hasEvents && !hasConversation) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h4 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">Engagement</h4>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Events timeline */}
      {hasEvents && (
        <div className="space-y-1.5">
          {engagement.events.map((event, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-mono w-36 shrink-0">
                {formatDate(event.timestamp)}
              </span>
              <span className="font-medium">
                {EVENT_LABELS[event.type] ?? event.type}
              </span>
              {event.source !== "assessment" && (
                <span className="text-muted-foreground">via {event.source}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conversation summary */}
      {hasConversation && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h5 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">
              Summary
            </h5>
            <Button
              variant="outline"
              size="sm"
              onClick={onGenerateSummary}
              disabled={isSummarizing}
              className="h-6 px-2 text-[10px] gap-1"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3" />
                  {engagement.summary ? "Regenerate" : "Create Summary"}
                </>
              )}
            </Button>
          </div>
          {engagement.summary && (
            <div className="bg-card border rounded-lg p-4">
              <Response variant="report">{engagement.summary}</Response>
            </div>
          )}
        </div>
      )}

      {/* Conversation transcript */}
      {hasConversation && (
        <div className="space-y-3">
          <h5 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">
            Conversation ({engagement.conversation!.length} messages)
          </h5>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {engagement.conversation!.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg p-3 text-sm",
                  msg.role === "user"
                    ? "bg-muted/50 border border-border/40"
                    : "bg-card border"
                )}
              >
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  {msg.role === "user" ? "User" : "Agent"}
                </span>
                {msg.role === "assistant" ? (
                  <Response variant="report">{msg.text}</Response>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EntryRow({
  entry,
  isExpanded,
  onToggle,
  onDownload,
  isDownloading,
  onGenerateSummary,
  isSummarizing,
  shouldReduceMotion,
}: {
  entry: QuizEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
  isDownloading: boolean;
  onGenerateSummary: () => void;
  isSummarizing: boolean;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="border rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Row header */}
      <div
        className={cn(
          "w-full px-4 py-3 flex items-center gap-3 transition-all duration-200",
          "hover:bg-[var(--quiz-cream)]/30",
          isExpanded && "bg-[var(--quiz-cream)]/20"
        )}
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-3 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quiz-gold)] focus-visible:ring-inset rounded"
          aria-expanded={isExpanded}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
          >
            <ChevronRight className="h-4 w-4 text-[var(--quiz-gold-dark)] shrink-0" />
          </motion.div>
          <span className="font-medium flex-1">
            {entry.name}
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
              {getVariant(entry.variant)?.name ?? entry.variant}
            </span>
          </span>
          <EngagementBadges engagement={entry.engagement} />
          <span className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</span>
          <span className="text-xs text-muted-foreground font-mono">{entry.id.slice(0, 8)}</span>
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          disabled={isDownloading}
          className="shrink-0 gap-1.5 border-[var(--quiz-gold)] text-[var(--quiz-gold-dark)] hover:bg-[var(--quiz-gold)]/10 hover:text-[var(--quiz-gold-dark)]"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              <span>PDF</span>
            </>
          )}
        </Button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t space-y-6">
              <QuizAnswersDisplay variant={entry.variant} answers={entry.answers} />

              {entry.report && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    AI Assessment
                  </h4>
                  <div className="bg-card border rounded-lg p-4">
                    <Response variant="report">{entry.report}</Response>
                  </div>
                </div>
              )}

              {!entry.report && (
                <p className="text-sm text-muted-foreground italic">No assessment generated</p>
              )}

              <EngagementSection
                engagement={entry.engagement}
                onGenerateSummary={onGenerateSummary}
                isSummarizing={isSummarizing}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminResultsPage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<QuizEntry[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState("");
  const [activeTab, setActiveTab] = useState<AdminTab>("quiz");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [expandedChatIds, setExpandedChatIds] = useState<Set<string>>(new Set());
  const [chatSummarizingId, setChatSummarizingId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchResults = useCallback(async (key: string, options?: { cursor?: string; search?: string; variant?: string }) => {
    const { cursor, search, variant } = options ?? {};
    const isLoadMore = !!cursor;
    const isSearch = !!search;

    if (isSearch) {
      setIsSearching(true);
    } else if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = new URL("/api/admin/results", window.location.origin);
      url.searchParams.set("key", key);
      if (variant) {
        url.searchParams.set("variant", variant);
      }
      if (search) {
        url.searchParams.set("search", search);
      } else if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const res = await fetch(url.toString());

      if (res.status === 401) {
        sessionStorage.removeItem("admin_password");
        setAuthState("unauthenticated");
        setError("Invalid password");
        setPassword("");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch results");
      }

      const data = await res.json();

      if (isLoadMore) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setNextCursor(data.nextCursor);
      sessionStorage.setItem("admin_password", key);
      setAuthState("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsSearching(false);
    }
  }, []);

  // Check for saved password on mount
  useEffect(() => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (savedPassword) {
      setPassword(savedPassword);
      // Don't fetch here — the search/filter effect handles it once authState changes
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, []);

  // Trigger search/filter when debounced search or variant changes
  useEffect(() => {
    if (authState !== "authenticated") return;
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;

    const variant = selectedVariant || undefined;

    if (debouncedSearch) {
      fetchResults(savedPassword, { search: debouncedSearch, variant });
    } else {
      fetchResults(savedPassword, { variant });
    }
  }, [debouncedSearch, selectedVariant, authState, fetchResults]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchResults(password);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    setPassword("");
    setEntries([]);
    setExpandedIds(new Set());
    setAuthState("unauthenticated");
  };

  const handleRefresh = () => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (savedPassword) {
      setNextCursor(null);
      const variant = selectedVariant || undefined;
      if (debouncedSearch) {
        fetchResults(savedPassword, { search: debouncedSearch, variant });
      } else {
        fetchResults(savedPassword, { variant });
      }
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
  };

  const handleLoadMore = () => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (savedPassword && nextCursor) {
      fetchResults(savedPassword, { cursor: nextCursor, variant: selectedVariant || undefined });
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleGenerateSummary = async (quizId: string) => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;

    setSummarizingId(quizId);
    setError(null);

    try {
      const response = await fetch("/api/admin/results/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId, key: savedPassword }),
      });

      if (response.status === 401) {
        sessionStorage.removeItem("admin_password");
        setAuthState("unauthenticated");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate summary");
      }

      const { summary } = await response.json();

      // Update the entry's engagement in local state
      setEntries((prev) =>
        prev.map((e) =>
          e.id === quizId && e.engagement
            ? { ...e, engagement: { ...e.engagement, summary } }
            : e
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary generation failed");
    } finally {
      setSummarizingId(null);
    }
  };

  const handleDownloadPdf = async (quizId: string) => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;

    setDownloadingId(quizId);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/results/pdf?key=${encodeURIComponent(savedPassword)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate PDF");
      }

      // Trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch?.[1] || `quiz-${quizId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF download failed");
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchChatSessions = useCallback(async (key: string) => {
    setIsChatLoading(true);
    setError(null);
    try {
      const url = new URL("/api/admin/chats", window.location.origin);
      url.searchParams.set("key", key);
      const res = await fetch(url.toString());
      if (res.status === 401) {
        sessionStorage.removeItem("admin_password");
        setAuthState("unauthenticated");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch chat sessions");
      const data = await res.json();
      setChatSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  const chatFetchedRef = useRef(false);

  // Fetch chat sessions when switching to chat tab
  useEffect(() => {
    if (activeTab !== "chat" || authState !== "authenticated") return;
    if (chatFetchedRef.current) return;
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;
    chatFetchedRef.current = true;
    fetchChatSessions(savedPassword);
  }, [activeTab, authState, fetchChatSessions]);

  const handleGenerateChatSummary = async (threadId: string) => {
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;

    setChatSummarizingId(threadId);
    setError(null);

    try {
      const response = await fetch("/api/admin/chats/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, key: savedPassword }),
      });

      if (response.status === 401) {
        sessionStorage.removeItem("admin_password");
        setAuthState("unauthenticated");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate summary");
      }

      const { summary } = await response.json();
      setChatSessions((prev) =>
        prev.map((s) =>
          s.threadId === threadId ? { ...s, summary } : s
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Summary generation failed");
    } finally {
      setChatSummarizingId(null);
    }
  };

  const toggleChatExpanded = (id: string) => {
    setExpandedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Loading state while checking session
  if (authState === "checking") {
    return (
      <div className="min-h-screen quiz-background flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--quiz-gold)]" />
        <span className="sr-only">Checking authentication…</span>
      </div>
    );
  }

  // Login form
  if (authState === "unauthenticated") {
    return (
      <div className="min-h-screen quiz-background flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 border-b">
          <div className="max-w-md mx-auto px-4 py-3 flex justify-end">
            <ModeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4 }}
            className="w-full max-w-sm space-y-6"
          >
            <div className="text-center">
              <h1 className="text-2xl font-bold quiz-question">Quiz Results</h1>
              <p className="text-muted-foreground mt-1">Enter password to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="h-12"
                autoFocus
                autoComplete="current-password"
              />

              {error && (
                <p className="text-sm text-destructive text-center" role="alert">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!password || isLoading}
                className={cn(
                  "w-full h-12 font-semibold transition-all duration-300",
                  "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)]",
                  "text-[var(--quiz-text-on-gold)]",
                  "hover:-translate-y-0.5 hover:shadow-lg",
                  "disabled:bg-muted disabled:text-muted-foreground disabled:translate-y-0 disabled:shadow-none"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Access Results"
                )}
              </Button>
            </form>
          </motion.div>
        </main>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen quiz-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/95 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-lg font-semibold quiz-question shrink-0">Admin</h1>

          {/* Tab toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5 shrink-0">
            <button
              onClick={() => setActiveTab("quiz")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                activeTab === "quiz"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Quiz Results
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                activeTab === "chat"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Conversations
            </button>
          </div>

          {/* Search input + variant filter (quiz tab only) */}
          {activeTab === "quiz" && <><div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name…"
              aria-label="Search submissions by name"
              className="pl-9 pr-8 h-9 focus-visible:ring-[var(--quiz-gold)]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quiz-gold)]"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
            {isSearching && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[var(--quiz-gold)]" />
            )}
          </div>

          {/* Variant filter */}
          <select
            value={selectedVariant}
            onChange={(e) => setSelectedVariant(e.target.value)}
            className="h-9 px-3 rounded-md border text-sm bg-background shrink-0"
            aria-label="Filter by variant"
          >
            <option value="">All Variants</option>
            {getAllVariants().map((v) => (
              <option key={v.slug} value={v.slug}>{v.name}</option>
            ))}
          </select></>}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isSearching}
              aria-label="Refresh results"
              className="hover:bg-[var(--quiz-cream)]/50"
            >
              <RefreshCw className={cn("h-4 w-4", (isLoading || isSearching) && "animate-spin")} />
            </Button>
            <ModeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Log out"
              className="hover:bg-[var(--quiz-cream)]/50"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          {/* ===== Chat Sessions Tab ===== */}
          {activeTab === "chat" && (
            <>
              {isChatLoading && (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--quiz-gold)]" />
                </div>
              )}

              {!isChatLoading && chatSessions.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No standalone conversations yet
                </div>
              )}

              {chatSessions.map((session, index) => {
                const isExpanded = expandedChatIds.has(session.threadId);
                const messageCount = session.conversation?.length ?? 0;
                const firstUserMsg = session.conversation?.find((m) => m.role === "user");
                const preview = firstUserMsg?.text.slice(0, 100) ?? "No messages";

                return (
                  <motion.div
                    key={session.threadId}
                    initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.05 }}
                  >
                    <div className="border rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-md">
                      <button
                        onClick={() => toggleChatExpanded(session.threadId)}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 transition-all duration-200 text-left",
                          "hover:bg-[var(--quiz-cream)]/30",
                          isExpanded && "bg-[var(--quiz-cream)]/20"
                        )}
                        aria-expanded={isExpanded}
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                        >
                          <ChevronRight className="h-4 w-4 text-[var(--quiz-gold-dark)] shrink-0" />
                        </motion.div>
                        <span className="font-medium flex-1 truncate">{preview}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          <MessagesSquare className="h-3 w-3" />
                          {messageCount} msgs
                        </span>
                        {session.events.some((e) => e.type === "booking_click") && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Calendar className="h-3 w-3" />
                            Booking clicked
                          </span>
                        )}
                        <span className="text-sm text-muted-foreground">{formatDate(session.createdAt)}</span>
                        <span className="text-xs text-muted-foreground font-mono">{session.threadId.slice(0, 12)}</span>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={shouldReduceMotion ? {} : { height: 0, opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t space-y-4">
                              {/* Summary */}
                              {session.conversation && session.conversation.length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3">
                                    <h5 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">
                                      Summary
                                    </h5>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleGenerateChatSummary(session.threadId)}
                                      disabled={chatSummarizingId === session.threadId}
                                      className="h-6 px-2 text-[10px] gap-1"
                                    >
                                      {chatSummarizingId === session.threadId ? (
                                        <>
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Generating…
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="h-3 w-3" />
                                          {session.summary ? "Regenerate" : "Create Summary"}
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                  {session.summary && (
                                    <div className="bg-card border rounded-lg p-4">
                                      <Response variant="report">{session.summary}</Response>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Transcript */}
                              {session.conversation && session.conversation.length > 0 && (
                                <div className="space-y-3">
                                  <h5 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">
                                    Conversation ({session.conversation.length} messages)
                                  </h5>
                                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                    {session.conversation.map((msg, i) => (
                                      <div
                                        key={i}
                                        className={cn(
                                          "rounded-lg p-3 text-sm",
                                          msg.role === "user"
                                            ? "bg-muted/50 border border-border/40"
                                            : "bg-card border"
                                        )}
                                      >
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                          {msg.role === "user" ? "User" : "Agent"}
                                        </span>
                                        {msg.role === "assistant" ? (
                                          <Response variant="report">{msg.text}</Response>
                                        ) : (
                                          <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}

              {chatSessions.length > 0 && !isChatLoading && (
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const savedPassword = sessionStorage.getItem("admin_password");
                      if (savedPassword) fetchChatSessions(savedPassword);
                    }}
                    className="gap-1.5 text-xs"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ===== Quiz Results Tab ===== */}
          {activeTab === "quiz" && entries.length === 0 && !isLoading && !isSearching && (
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              {debouncedSearch
                ? `No submissions found for "${debouncedSearch}"`
                : "No quiz submissions yet"}
            </motion.div>
          )}

          {activeTab === "quiz" && entries.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.05 }}
            >
              <EntryRow
                entry={entry}
                isExpanded={expandedIds.has(entry.id)}
                onToggle={() => toggleExpanded(entry.id)}
                onDownload={() => handleDownloadPdf(entry.id)}
                isDownloading={downloadingId === entry.id}
                onGenerateSummary={() => handleGenerateSummary(entry.id)}
                isSummarizing={summarizingId === entry.id}
                shouldReduceMotion={shouldReduceMotion}
              />
            </motion.div>
          ))}

          {activeTab === "quiz" && entries.length > 0 && (
            <div className="pt-4 space-y-3">
              {/* Only show Load More when not searching and there are more results */}
              {nextCursor && !debouncedSearch && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="gap-2 border-[var(--quiz-gold)] text-[var(--quiz-gold-dark)] hover:bg-[var(--quiz-gold)]/10"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
              <motion.p
                initial={shouldReduceMotion ? {} : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={shouldReduceMotion ? { duration: 0 } : { delay: 0.2 }}
                className="text-center text-sm text-muted-foreground"
              >
                {debouncedSearch
                  ? `Found ${entries.length} result${entries.length === 1 ? "" : "s"} for "${debouncedSearch}"`
                  : `Showing ${entries.length} result${entries.length === 1 ? "" : "s"}${!nextCursor ? " (all loaded)" : ""}`}
              </motion.p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

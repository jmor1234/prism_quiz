"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, LogOut, RefreshCw, Loader2, Download, Search, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Response } from "@/components/ai-elements/response";
import { cn } from "@/lib/utils";
import type { QuizSubmission } from "@/lib/schemas/quiz";
import { wakeReasonLabels, bowelIssueLabels } from "@/lib/labels/quizLabels";

// ============================================================================
// Types
// ============================================================================

interface QuizEntry {
  id: string;
  createdAt: string;
  submission: QuizSubmission;
  report: string | null;
}

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

function EnergyLevel({ level }: { level: number }) {
  // Color coding: 1-3 low (amber), 4-6 medium (yellow), 7-10 good (emerald)
  const getColor = (l: number) => {
    if (l <= 3) return "text-amber-600 dark:text-amber-400";
    if (l <= 6) return "text-yellow-600 dark:text-yellow-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  return (
    <div className="flex items-baseline gap-1">
      <span className={cn("text-2xl font-bold tabular-nums tracking-tight", getColor(level))}>
        {level}
      </span>
      <span className="text-sm text-foreground/40 font-medium">/10</span>
    </div>
  );
}

function QuizAnswersDisplay({ submission }: { submission: QuizSubmission }) {
  const hasWakeReasons = submission.wakeAtNight.wakes && submission.wakeAtNight.reasons?.length;
  const hasBowelIssues = submission.bowelIssues.length > 0;

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <h4 className="text-[11px] font-semibold text-foreground/50 uppercase tracking-[0.1em]">
          Quiz Answers
        </h4>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Main content: 3-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr] gap-6">

        {/* Energy Level - prominent display */}
        <div className="flex flex-col justify-center">
          <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide mb-1">
            Energy
          </span>
          <EnergyLevel level={submission.energyLevel} />
        </div>

        {/* Symptoms Column 1 */}
        <div className="bg-card/50 dark:bg-card/30 rounded-md px-3 py-0.5 border border-border/40">
          <YesNoIndicator label="Crashes after lunch" value={submission.crashAfterLunch} />
          <YesNoIndicator label="Difficulty waking" value={submission.difficultyWaking} />
          <YesNoIndicator label="Brain fog" value={submission.brainFog} />
        </div>

        {/* Symptoms Column 2 */}
        <div className="bg-card/50 dark:bg-card/30 rounded-md px-3 py-0.5 border border-border/40">
          <YesNoIndicator label="Cold extremities" value={submission.coldExtremities} />
          <YesNoIndicator label="White tongue" value={submission.whiteTongue} />
          <YesNoIndicator label="Wakes at night" value={submission.wakeAtNight.wakes} />
        </div>
      </div>

      {/* Additional details row */}
      {(hasWakeReasons || hasBowelIssues) && (
        <div className="flex flex-wrap gap-x-10 gap-y-2">
          {hasWakeReasons && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-foreground/60 font-medium">Wake reasons:</span>
              <span className="text-sm text-foreground font-medium">
                {submission.wakeAtNight.reasons!.map((r) => wakeReasonLabels[r]).join(", ")}
              </span>
            </div>
          )}
          {hasBowelIssues && (
            <div className="flex items-baseline gap-2">
              <span className="text-sm text-foreground/60 font-medium">Bowel issues:</span>
              <span className="text-sm text-foreground font-medium">
                {submission.bowelIssues.map((issue) => bowelIssueLabels[issue]).join(", ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Free text answers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
        <div>
          <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider block mb-1.5">
            Typical Eating
          </span>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {submission.typicalEating}
          </p>
        </div>
        <div>
          <span className="text-xs font-semibold text-foreground/50 uppercase tracking-wider block mb-1.5">
            Health Goals
          </span>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {submission.healthGoals}
          </p>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  isExpanded,
  onToggle,
  onDownload,
  isDownloading,
  shouldReduceMotion,
}: {
  entry: QuizEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onDownload: () => void;
  isDownloading: boolean;
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
          <span className="font-medium flex-1">{entry.submission.name}</span>
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
              <QuizAnswersDisplay submission={entry.submission} />

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
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchResults = useCallback(async (key: string, options?: { cursor?: string; search?: string }) => {
    const { cursor, search } = options ?? {};
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
      fetchResults(savedPassword);
    } else {
      setAuthState("unauthenticated");
    }
  }, [fetchResults]);

  // Trigger search when debounced search changes
  useEffect(() => {
    if (authState !== "authenticated") return;
    const savedPassword = sessionStorage.getItem("admin_password");
    if (!savedPassword) return;

    if (debouncedSearch) {
      fetchResults(savedPassword, { search: debouncedSearch });
    } else {
      // Clear search, fetch normal paginated results
      fetchResults(savedPassword);
    }
  }, [debouncedSearch, authState, fetchResults]);

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
      if (debouncedSearch) {
        fetchResults(savedPassword, { search: debouncedSearch });
      } else {
        fetchResults(savedPassword);
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
      fetchResults(savedPassword, { cursor: nextCursor });
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
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
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
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
          <h1 className="text-lg font-semibold quiz-question shrink-0">Quiz Results</h1>

          {/* Search input */}
          <div className="relative flex-1 max-w-xs">
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

          {entries.length === 0 && !isLoading && !isSearching && (
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

          {entries.map((entry, index) => (
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
                shouldReduceMotion={shouldReduceMotion}
              />
            </motion.div>
          ))}

          {entries.length > 0 && (
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

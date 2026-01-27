"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, LogOut, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Response } from "@/components/ai-elements/response";
import { cn } from "@/lib/utils";
import type { QuizSubmission, WakeReason, BowelIssueType } from "@/lib/schemas/quiz";

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
// Label Mappings
// ============================================================================

const wakeReasonLabels: Record<WakeReason, string> = {
  no_reason: "No apparent reason",
  eat: "To eat",
  drink: "To drink",
  pee: "To urinate",
};

const bowelIssueLabels: Record<BowelIssueType, string> = {
  straining: "Straining",
  pain: "Pain",
  incomplete: "Incomplete emptying",
  diarrhea: "Diarrhea",
  smell: "Excessive smell/mess",
};

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
  shouldReduceMotion,
}: {
  entry: QuizEntry;
  isExpanded: boolean;
  onToggle: () => void;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="border rounded-lg overflow-hidden transition-shadow duration-200 hover:shadow-md">
      {/* Row header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 flex items-center gap-3 text-left transition-all duration-200",
          "hover:bg-[var(--quiz-cream)]/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--quiz-gold)] focus-visible:ring-inset",
          isExpanded && "bg-[var(--quiz-cream)]/20"
        )}
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
  const shouldReduceMotion = useReducedMotion();

  const fetchResults = useCallback(async (key: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/results?key=${encodeURIComponent(key)}`);

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
      setEntries(data.entries);
      sessionStorage.setItem("admin_password", key);
      setAuthState("authenticated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
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
      fetchResults(savedPassword);
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
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold quiz-question">Quiz Results</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              aria-label="Refresh results"
              className="hover:bg-[var(--quiz-cream)]/50"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
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

          {entries.length === 0 && !isLoading && (
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12 text-muted-foreground"
            >
              No quiz submissions yet
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
                shouldReduceMotion={shouldReduceMotion}
              />
            </motion.div>
          ))}

          {entries.length > 0 && (
            <motion.p
              initial={shouldReduceMotion ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={shouldReduceMotion ? { duration: 0 } : { delay: entries.length * 0.05 + 0.2 }}
              className="text-center text-sm text-muted-foreground pt-4"
            >
              Showing {entries.length} result{entries.length === 1 ? "" : "s"}
            </motion.p>
          )}
        </div>
      </main>
    </div>
  );
}

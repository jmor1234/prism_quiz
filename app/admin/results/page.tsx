"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, LogOut, RefreshCw, Loader2 } from "lucide-react";

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

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================================================
// Sub-components
// ============================================================================

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        value
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
      )}
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function EnergyLevelBar({ level }: { level: number }) {
  const percentage = (level / 10) * 100;
  const getColor = () => {
    if (level <= 3) return "bg-red-500";
    if (level <= 5) return "bg-orange-500";
    if (level <= 7) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
        <div
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-semibold tabular-nums">{level}/10</span>
    </div>
  );
}

function QuizAnswersDisplay({ submission }: { submission: QuizSubmission }) {
  return (
    <div className="space-y-5">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Quiz Answers
      </h4>

      {/* Main stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Energy Level - full width */}
        <div className="sm:col-span-2 bg-muted/30 rounded-lg p-4 border">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Energy Level</span>
            <EnergyLevelBar level={submission.energyLevel} />
          </div>
        </div>

        {/* Yes/No questions */}
        <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Crashes after lunch</span>
            <YesNoBadge value={submission.crashAfterLunch} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Difficulty waking</span>
            <YesNoBadge value={submission.difficultyWaking} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Brain fog</span>
            <YesNoBadge value={submission.brainFog} />
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Cold extremities</span>
            <YesNoBadge value={submission.coldExtremities} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">White tongue coating</span>
            <YesNoBadge value={submission.whiteTongue} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Wakes at night</span>
            <YesNoBadge value={submission.wakeAtNight.wakes} />
          </div>
        </div>

        {/* Conditional: Wake reasons */}
        {submission.wakeAtNight.wakes && submission.wakeAtNight.reasons?.length ? (
          <div className="sm:col-span-2 bg-muted/30 rounded-lg p-4 border">
            <span className="text-sm text-muted-foreground">Wake reasons: </span>
            <span className="text-sm">
              {submission.wakeAtNight.reasons.map((r) => wakeReasonLabels[r]).join(", ")}
            </span>
          </div>
        ) : null}

        {/* Bowel issues */}
        <div className="sm:col-span-2 bg-muted/30 rounded-lg p-4 border">
          <span className="text-sm text-muted-foreground">Bowel issues: </span>
          {submission.bowelIssues.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {submission.bowelIssues.map((issue) => (
                <span
                  key={issue}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  {bowelIssueLabels[issue]}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm">None reported</span>
          )}
        </div>
      </div>

      {/* Free text answers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-muted/30 rounded-lg p-4 border">
          <span className="text-sm font-medium text-muted-foreground block mb-2">
            Typical eating
          </span>
          <p className="text-sm whitespace-pre-wrap">{submission.typicalEating}</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 border">
          <span className="text-sm font-medium text-muted-foreground block mb-2">
            Health goals
          </span>
          <p className="text-sm whitespace-pre-wrap">{submission.healthGoals}</p>
        </div>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: QuizEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Row header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
          "hover:bg-muted/50",
          isExpanded && "bg-muted/30"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-medium flex-1">{entry.submission.name}</span>
        <span className="text-sm text-muted-foreground">{formatDate(entry.createdAt)}</span>
        <span className="text-xs text-muted-foreground font-mono">{entry.id.slice(0, 8)}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
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
      )}
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Login form
  if (authState === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-md mx-auto px-4 py-3 flex justify-end">
            <ModeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Quiz Results</h1>
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
              />

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <Button
                type="submit"
                disabled={!password || isLoading}
                className="w-full h-12"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Access Results"
                )}
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Quiz Results</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {entries.length === 0 && !isLoading && (
            <div className="text-center py-12 text-muted-foreground">
              No quiz submissions yet
            </div>
          )}

          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedIds.has(entry.id)}
              onToggle={() => toggleExpanded(entry.id)}
            />
          ))}

          {entries.length > 0 && (
            <p className="text-center text-sm text-muted-foreground pt-4">
              Showing {entries.length} result{entries.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

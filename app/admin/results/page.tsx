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

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

// ============================================================================
// Sub-components
// ============================================================================

function QuizAnswersDisplay({ submission }: { submission: QuizSubmission }) {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: submission.name },
    { label: "Energy Level", value: `${submission.energyLevel}/10` },
    { label: "Crashes after lunch", value: formatBoolean(submission.crashAfterLunch) },
    { label: "Difficulty waking", value: formatBoolean(submission.difficultyWaking) },
    {
      label: "Wakes at night",
      value: submission.wakeAtNight.wakes
        ? submission.wakeAtNight.reasons?.length
          ? `Yes (${submission.wakeAtNight.reasons.map((r) => wakeReasonLabels[r]).join(", ")})`
          : "Yes"
        : "No",
    },
    { label: "Brain fog", value: formatBoolean(submission.brainFog) },
    {
      label: "Bowel issues",
      value:
        submission.bowelIssues.length > 0
          ? submission.bowelIssues.map((i) => bowelIssueLabels[i]).join(", ")
          : "None",
    },
    { label: "Cold extremities", value: formatBoolean(submission.coldExtremities) },
    { label: "White tongue coating", value: formatBoolean(submission.whiteTongue) },
  ];

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
        Quiz Answers
      </h4>
      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-2 text-sm">
            <span className="font-medium min-w-[140px] text-muted-foreground">{row.label}:</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Free text answers */}
      <div className="space-y-3 pt-2">
        <div>
          <span className="font-medium text-sm text-muted-foreground">Typical eating:</span>
          <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
            {submission.typicalEating}
          </p>
        </div>
        <div>
          <span className="font-medium text-sm text-muted-foreground">Health goals:</span>
          <p className="mt-1 text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
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

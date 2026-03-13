"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Search,
  RefreshCw,
  LogOut,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Response } from "@/components/ai-elements/response";
import type { IntakeStep } from "@/app/api/assessment/types";

// --- Types ---

interface AssessmentEngagement {
  assessmentId: string;
  events: { type: string; timestamp: string }[];
  updatedAt: string;
}

interface AssessmentEntry {
  id: string;
  createdAt: string;
  name: string;
  steps: IntakeStep[];
  report: string;
  engagement: AssessmentEngagement | null;
}

type AuthState = "checking" | "unauthenticated" | "authenticated";

// --- Helpers ---

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function bookingClickCount(engagement: AssessmentEngagement | null): number {
  if (!engagement) return 0;
  return engagement.events.filter((e) => e.type === "booking_click").length;
}

// --- Components ---

function IntakeStepsDisplay({ steps }: { steps: IntakeStep[] }) {
  const filtered = steps.filter((s) => s.question !== "[transition]");

  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No intake data available
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {filtered.map((step, i) => (
        <div key={i} className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{step.question}</p>
          {step.selectedOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {step.selectedOptions.map((opt) => (
                <span
                  key={opt}
                  className="inline-block px-2.5 py-0.5 text-xs rounded-full bg-[var(--quiz-gold)]/10 text-[var(--quiz-gold-dark)] border border-[var(--quiz-gold)]/30"
                >
                  {opt}
                </span>
              ))}
            </div>
          )}
          {step.freeText.trim() && (
            <p className="text-sm text-muted-foreground pl-3 border-l-2 border-border">
              {step.freeText}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function EntryRow({
  entry,
  index,
}: {
  entry: AssessmentEntry;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const clicks = bookingClickCount(entry.engagement);

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        shouldReduceMotion ? { duration: 0 } : { delay: index * 0.03 }
      }
      className="border rounded-lg overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
        )}

        <span className="font-medium text-sm truncate flex-1">
          {entry.name || "Anonymous"}
        </span>

        {clicks > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
            <ExternalLink className="w-3 h-3" />
            {clicks}
          </span>
        )}

        <span className="text-xs text-muted-foreground shrink-0">
          {formatDate(entry.createdAt)}
        </span>

        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {shortId(entry.id)}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-6 border-t">
          {/* Intake responses */}
          <div className="pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Intake Responses
            </h3>
            <IntakeStepsDisplay steps={entry.steps} />
          </div>

          {/* Assessment report */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Assessment Report
            </h3>
            {entry.report ? (
              <div className="rounded-lg border bg-card p-4">
                <Response variant="report">{entry.report}</Response>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No report generated
              </p>
            )}
          </div>

          {/* Engagement */}
          {entry.engagement && entry.engagement.events.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Engagement
              </h3>
              <div className="space-y-1">
                {entry.engagement.events.map((event, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Booking click</span>
                    <span>{formatDate(event.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// --- Main Page ---

export default function AdminAssessmentsPage() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [password, setPassword] = useState("");
  const [entries, setEntries] = useState<AssessmentEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getKey = useCallback(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("admin_password") ?? "";
  }, []);

  const fetchEntries = useCallback(
    async (cursor?: string, search?: string) => {
      setLoading(true);
      setError(null);

      try {
        const key = getKey();
        const params = new URLSearchParams({ key, limit: "50" });
        if (search) params.set("search", search);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/assessments?${params}`);

        if (res.status === 401) {
          sessionStorage.removeItem("admin_password");
          setAuthState("unauthenticated");
          return;
        }

        if (!res.ok) throw new Error("Failed to fetch");

        const data = await res.json();

        if (cursor) {
          setEntries((prev) => [...prev, ...data.entries]);
        } else {
          setEntries(data.entries);
        }
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch assessments"
        );
      } finally {
        setLoading(false);
      }
    },
    [getKey]
  );

  // Auth check on mount
  useEffect(() => {
    const stored = sessionStorage.getItem("admin_password");
    if (stored) {
      setAuthState("authenticated");
    } else {
      setAuthState("unauthenticated");
    }
  }, []);

  // Fetch on auth
  useEffect(() => {
    if (authState === "authenticated") {
      fetchEntries();
    }
  }, [authState, fetchEntries]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setActiveSearch(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Re-fetch on search change
  useEffect(() => {
    if (authState === "authenticated") {
      fetchEntries(undefined, activeSearch || undefined);
    }
  }, [activeSearch, authState, fetchEntries]);

  const handleLogin = () => {
    sessionStorage.setItem("admin_password", password);
    setAuthState("authenticated");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("admin_password");
    setAuthState("unauthenticated");
    setEntries([]);
    setPassword("");
  };

  const handleRefresh = () => {
    setSearchInput("");
    setActiveSearch("");
    fetchEntries();
  };

  // --- Auth screen ---

  if (authState === "checking") {
    return <div className="min-h-screen bg-background" />;
  }

  if (authState === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">
            Assessment Admin
          </h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password) handleLogin();
            }}
            placeholder="Admin password"
            className="w-full px-4 py-2.5 rounded-lg border bg-card text-sm"
          />
          <button
            type="button"
            onClick={handleLogin}
            disabled={!password}
            className="w-full px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-50"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // --- Main view ---

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Assessment Submissions</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn("w-4 h-4", loading && "animate-spin")}
              />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-card text-sm"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Search result count */}
        {activeSearch && !loading && (
          <p className="text-sm text-muted-foreground">
            Found {entries.length} result{entries.length !== 1 ? "s" : ""} for
            &ldquo;{activeSearch}&rdquo;
          </p>
        )}

        {/* Entries */}
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <EntryRow key={entry.id} entry={entry} index={i} />
          ))}

          {!loading && entries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No assessment submissions yet
            </p>
          )}
        </div>

        {/* Load more */}
        {nextCursor && !activeSearch && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => fetchEntries(nextCursor)}
              disabled={loading}
              className="px-6 py-2 rounded-lg border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {/* Count */}
        {entries.length > 0 && !nextCursor && !activeSearch && (
          <p className="text-center text-xs text-muted-foreground">
            {entries.length} submission{entries.length !== 1 ? "s" : ""} loaded
          </p>
        )}
      </div>
    </div>
  );
}

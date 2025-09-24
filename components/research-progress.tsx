// components/research-progress.tsx
"use client";

import { Activity, Check, AlertCircle, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState, useEffect, useRef } from "react";
import AnimatedNumber from "@/components/research/animated-number";
import type {
  ResearchObjectiveData,
  ResearchState,
} from "@/lib/streaming-types";
import { ObjectiveDetails } from "@/components/research-objective-details";
import { Task, TaskTrigger, TaskContent } from "@/components/ai-elements/task";
import { Loader } from "@/components/ai-elements/loader";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtSearchResults,
  ChainOfThoughtSearchResult,
} from "@/components/ai-elements/chain-of-thought";

interface ResearchProgressProps {
  state: ResearchState;
  className?: string;
}

export function ResearchProgress({ state, className }: ResearchProgressProps) {
  const { session, objectives, phases, currentOperation, searchProgress, currentToolStatus } = state;
  // Per-objective view toggle to avoid showing both pipeline and details at once
  const [showDetailsMap, setShowDetailsMap] = useState<Record<string, boolean>>({});
  const collections = state.collections || {};
  const faviconFor = (domain?: string) => (domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : undefined);

  // Calculate actual progress based on objective progress
  const objectivesList = useMemo(() => Object.values(objectives), [objectives]);
  const overallProgress = objectivesList.length > 0
    ? (objectivesList.reduce((sum, obj) => sum + obj.progress, 0) / objectivesList.length) * 100
    : 0;

  // Determine sorted objective order
  const sortedEntries = useMemo(() => {
    const entries = Object.entries(objectives);
    const rankStatus = (s: ResearchObjectiveData["status"]) => {
      switch (s) {
        case 'active': return 0;
        case 'pending': return 1;
        case 'complete': return 2;
        case 'failed': return 3;
        default: return 4;
      }
    };
    return entries.sort((a, b) => {
      const ra = rankStatus(a[1].status);
      const rb = rankStatus(b[1].status);
      if (ra !== rb) return ra - rb;
      // For same status, higher progress first
      return (b[1].progress ?? 0) - (a[1].progress ?? 0);
    });
  }, [objectives]);

  // Multi-open objective state. Auto-open only once (first active or first entry).
  const [openObjectives, setOpenObjectives] = useState<Record<string, boolean>>({});
  const didAutoOpenRef = useRef(false);
  useEffect(() => {
    if (didAutoOpenRef.current) return;
    if (sortedEntries.length === 0) return;
    const firstActive = sortedEntries.find(([, o]) => o.status === 'active')?.[0];
    const toOpen = firstActive ?? sortedEntries[0][0];
    setOpenObjectives({ [toOpen]: true });
    didAutoOpenRef.current = true;
  }, [sortedEntries]);

  // Guard after hooks so hooks order is stable across renders
  if (!session || (session.status !== 'starting' && session.status !== 'active')) {
    return null;
  }

  return (
    <div className={cn(
      "mx-3 my-3",
      "relative",
      "rounded-2xl",
      "border",
      "bg-gradient-to-b from-background/90 to-muted/10",
      "shadow-sm",
      "overflow-hidden",
      "animate-in fade-in-50 slide-in-from-top-1 duration-500",
      className
    )}>
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <div className="px-4 py-3.5">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Research in Progress
              </h3>
              <p className="text-xs text-muted-foreground">
                {session.completedObjectives} of {session.totalObjectives} objectives
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums">
              <AnimatedNumber value={overallProgress} format={(n) => `${Math.round(n)}%`} />
            </div>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="relative h-1.5 rounded-full overflow-hidden mb-4 bg-muted/30">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out bg-gradient-to-r from-primary via-primary/90 to-primary/70"
            style={{ width: `${overallProgress}%` }}
          />
          {/* Shimmer effect for active progress */}
          {overallProgress > 0 && overallProgress < 100 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
              style={{ width: `${overallProgress}%` }}
            />
          )}
        </div>

        {/* Objectives List */}
        <div className="space-y-3">
          {sortedEntries.map(([objectiveId, objective], idx) => {
            const isOpen = !!openObjectives[objectiveId];
            const percent = Math.round((objective.progress ?? 0) * 100);
            const phaseLabels: Record<string, string> = {
              'query-generation': 'Generating',
              'searching': 'Searching',
              'deduplicating': 'Processing',
              'analyzing': 'Analyzing',
              'consolidating': 'Consolidating',
              'synthesizing': 'Synthesizing',
            };
            return (
              <Task
                key={objectiveId}
                open={isOpen}
                onOpenChange={(open) => setOpenObjectives((prev) => ({ ...prev, [objectiveId]: open }))}
                className={cn(
                  "motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-top-1",
                  `motion-safe:animation-delay-${idx * 50}`
                )}
              >
                {/* Screen reader announcements */}
                <div className="sr-only" aria-live="polite" aria-atomic="true">
                  {objective.status === 'active' && objective.phase &&
                    `Research objective ${idx + 1}: ${phaseLabels[objective.phase]}. ${percent}% complete.`}
                </div>
                <div className="sr-only" role="status" aria-live="polite">
                  {objective.status === 'complete' && `Objective ${idx + 1} completed successfully.`}
                  {objective.status === 'failed' && `Objective ${idx + 1} failed.`}
                </div>
                <TaskTrigger
                  title={objective.objective}
                  className="cursor-pointer rounded-md transition-all duration-200 hover:bg-accent/60 dark:hover:bg-accent/40 hover:ring-1 hover:ring-border/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 data-[state=closed]:px-3 data-[state=closed]:py-2.5 data-[state=open]:px-2.5 data-[state=open]:py-2 data-[state=open]:bg-accent/30 data-[state=open]:ring-1 data-[state=open]:ring-border/70 data-[state=open]:shadow-md"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium leading-tight truncate">{objective.objective}</p>
                      <div className="mt-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width] duration-500",
                            objective.status === 'active' && "bg-primary",
                            objective.status === 'complete' && "bg-emerald-500",
                            objective.status === 'failed' && "bg-red-500",
                            objective.status === 'pending' && "bg-muted"
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {/* Status icon with consistent meaning */}
                      {objective.status === 'complete' && (
                        <div className="grid place-items-center h-5 w-5 rounded-full bg-emerald-500/10">
                          <Check className="h-3 w-3 text-emerald-500" aria-label="Complete" />
                        </div>
                      )}
                      {objective.status === 'failed' && (
                        <div className="grid place-items-center h-5 w-5 rounded-full bg-red-500/10">
                          <AlertCircle className="h-3 w-3 text-red-500" aria-label="Failed" />
                        </div>
                      )}
                      {objective.status === 'active' && (
                        <div className="grid place-items-center h-5 w-5 rounded-full bg-primary/10">
                          <Sparkles className="h-3 w-3 text-primary animate-pulse" aria-label="Active" />
                        </div>
                      )}
                      {objective.status === 'pending' && (
                        <div className="grid place-items-center h-5 w-5 rounded-full bg-muted/50">
                          <Clock className="h-3 w-3 text-muted-foreground" aria-label="Pending" />
                        </div>
                      )}
                      {objective.phase && (
                        <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {phaseLabels[objective.phase]}
                        </span>
                      )}
                      <span className="rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/80">{percent}%</span>
                    </div>
                  </div>
                </TaskTrigger>
                <TaskContent>
                  {/* Segmented control for Pipeline/Details toggle */}
                  <div className="mb-2 flex items-center justify-end">
                    <div className="inline-flex rounded-lg border bg-muted/30 p-0.5" role="group" aria-label="View mode">
                      <button
                        type="button"
                        aria-pressed={!showDetailsMap[objectiveId]}
                        className={cn(
                          "text-xs rounded-md px-3 py-1 transition-all",
                          !showDetailsMap[objectiveId]
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setShowDetailsMap((m) => ({ ...m, [objectiveId]: false }))}
                      >
                        Pipeline
                      </button>
                      <button
                        type="button"
                        aria-pressed={!!showDetailsMap[objectiveId]}
                        className={cn(
                          "text-xs rounded-md px-3 py-1 transition-all",
                          showDetailsMap[objectiveId]
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setShowDetailsMap((m) => ({ ...m, [objectiveId]: true }))}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                  {/* Contextual transient statuses at top for primary objective */}
                  {idx === 0 && (currentToolStatus || currentOperation || searchProgress) && (
                    <div className="mb-2 space-y-1">
                      {currentToolStatus && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader className="text-violet-500" size={12} />
                          <span>{currentToolStatus.action}</span>
                        </div>
                      )}
                      {currentOperation && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader className="text-primary" size={12} />
                          <span>{currentOperation.message}</span>
                        </div>
                      )}
                      {searchProgress && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-primary">{searchProgress.resultsFound || 0}</span>
                          <span>results found</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Narrative, collapsed by default to reduce clutter */}
                  {!showDetailsMap[objectiveId] && (
                    <ChainOfThought defaultOpen>
                      <ChainOfThoughtHeader>Research pipeline</ChainOfThoughtHeader>
                      <ChainOfThoughtContent>
                      {([
                        'objective',
                        'query-generation',
                        'searching',
                        'deduplicating',
                        'analyzing',
                        'consolidating',
                        'synthesizing',
                      ] as const).map((phaseKey) => {
                        const id = `${objectiveId}-${phaseKey}`;
                        const p = phases[id];
                        const status: 'complete' | 'active' | 'pending' = phaseKey === 'objective'
                          ? 'complete'
                          : p?.status === 'complete'
                            ? 'complete'
                            : (p?.status === 'starting' || p?.status === 'active')
                              ? 'active'
                              : 'pending';
                        const collectionIdForPhase = (() => {
                          if (phaseKey === 'searching') return `${objectiveId}-search-hits`;
                          if (phaseKey === 'deduplicating') return `${objectiveId}-unique-urls`;
                          if (phaseKey === 'analyzing') return `${objectiveId}-analyzed`;
                          if (phaseKey === 'consolidating') return `${objectiveId}-consolidated`;
                          if (phaseKey === 'synthesizing') return undefined;
                          return undefined;
                        })();

                        return (
                          <ChainOfThoughtStep
                            key={id}
                            label={(() => {
                              const labels: Record<string, string> = {
                                'objective': 'Objective',
                                'query-generation': 'Query generation',
                                'searching': 'Searching',
                                'deduplicating': 'Deduplicating',
                                'analyzing': 'Analyzing',
                                'consolidating': 'Consolidating',
                                'synthesizing': 'Synthesizing',
                              };
                              return labels[phaseKey];
                            })()}
                            status={status}
                          >
                            {/* Objective overview at the top of pipeline */}
                            {phaseKey === 'objective' && (
                              <div className="mt-1 space-y-2">
                                <div className="text-[12px] text-foreground/90">{objective.objective}</div>
                                {(objective.keyEntities && objective.keyEntities.length > 0) && (
                                  <ChainOfThoughtSearchResults>
                                    {objective.keyEntities.slice(0, 6).map((e, i) => (
                                      <ChainOfThoughtSearchResult key={`ent-${i}`} className="rounded-full border border-border bg-muted text-foreground/80">
                                        {e}
                                      </ChainOfThoughtSearchResult>
                                    ))}
                                  </ChainOfThoughtSearchResults>
                                )}
                                {(objective.focusAreas && objective.focusAreas.length > 0) && (
                                  <ChainOfThoughtSearchResults>
                                    {objective.focusAreas.slice(0, 6).map((f, i) => (
                                      <ChainOfThoughtSearchResult key={`fa-${i}`} className="rounded-full border border-border bg-muted text-foreground/80">
                                        {f}
                                      </ChainOfThoughtSearchResult>
                                    ))}
                                  </ChainOfThoughtSearchResults>
                                )}
                                {objective.categories && objective.categories.length > 0 && (
                                  <ChainOfThoughtSearchResults>
                                    {objective.categories.slice(0, 6).map((c, i) => (
                                      <ChainOfThoughtSearchResult key={`cat-${i}`} className="rounded-full border border-border bg-muted text-foreground/80">
                                        {c}
                                      </ChainOfThoughtSearchResult>
                                    ))}
                                  </ChainOfThoughtSearchResults>
                                )}
                              </div>
                            )}
                            {/* Searching summary chips (with queries count chip) */}
                            {phaseKey === 'searching' && (p?.details?.summary || (p?.details?.queries && p.details.queries.length > 0)) && (
                              <ChainOfThoughtSearchResults>
                                <ChainOfThoughtSearchResult>
                                  {(p?.details?.summary?.queries ?? p?.details?.queries?.length ?? '—')} queries
                                </ChainOfThoughtSearchResult>
                                {typeof p?.details?.summary?.hits !== 'undefined' && (
                                  <ChainOfThoughtSearchResult>
                                    {p.details.summary!.hits} hits
                                  </ChainOfThoughtSearchResult>
                                )}
                                {typeof p?.details?.summary?.unique !== 'undefined' && (
                                  <ChainOfThoughtSearchResult>
                                    {p.details.summary!.unique} unique
                                  </ChainOfThoughtSearchResult>
                                )}
                              </ChainOfThoughtSearchResults>
                            )}
                            {/* Representative queries (≤6) with Show all like URLs */}
                            {phaseKey === 'query-generation' && p?.details?.queries && p.details.queries.length > 0 && (
                              <>
                                <ChainOfThoughtSearchResults>
                                  {p.details.queries.slice(0, 6).map((q, i) => (
                                    <ChainOfThoughtSearchResult key={`${id}-q-${i}`} className="rounded-full border border-border bg-muted text-foreground/80" title={q}>
                                      {q}
                                    </ChainOfThoughtSearchResult>
                                  ))}
                                </ChainOfThoughtSearchResults>
                                {p.details.queries.length > 6 && (
                                  <button
                                    type="button"
                                    className="text-[11px] text-primary underline-offset-2 hover:underline ml-1"
                                    onClick={() => setShowDetailsMap((m) => ({ ...m, [objectiveId]: true }))}
                                  >
                                    Show all
                                  </button>
                                )}
                              </>
                            )}
                            {/* Subphase metrics */}
                            {p?.details?.metrics && (
                              <ChainOfThoughtSearchResults>
                                {p.details.metrics.fetched && (
                                  <ChainOfThoughtSearchResult>
                                    Fetched {p.details.metrics.fetched.ok}/{p.details.metrics.fetched.total}
                                  </ChainOfThoughtSearchResult>
                                )}
                                {p.details.metrics.highSignal && (
                                  <ChainOfThoughtSearchResult>
                                    High-signal {p.details.metrics.highSignal.ok}/{p.details.metrics.highSignal.total}
                                  </ChainOfThoughtSearchResult>
                                )}
                                {p.details.metrics.analyzed && (
                                  <ChainOfThoughtSearchResult>
                                    Analyzed {p.details.metrics.analyzed.current}/{p.details.metrics.analyzed.total}
                                  </ChainOfThoughtSearchResult>
                                )}
                                {p.details.metrics.consolidated && (
                                  <ChainOfThoughtSearchResult>
                                    Consolidated {p.details.metrics.consolidated.current}/{p.details.metrics.consolidated.total}
                                  </ChainOfThoughtSearchResult>
                                )}
                              </ChainOfThoughtSearchResults>
                            )}
                            {/* Sample domains (minimal, with favicons) */}
                            {p?.details?.samples && p.details.samples.length > 0 && (
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {p.details.samples.slice(0, 6).map((s, si) => {
                                  let domain = s.domain;
                                  if (!domain) { try { domain = new URL(s.url).hostname.replace(/^www\./,''); } catch {}
                                  }
                                  return (
                                    <a
                                      key={`${id}-sample-${si}`}
                                      href={s.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                      title={s.title || s.url}
                                    >
                                      {domain && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={faviconFor(domain)} alt="" className="h-3 w-3 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                      )}
                                      <span className="truncate max-w-[200px]">{domain || s.url}</span>
                                    </a>
                                  );
                                })}
                                {collectionIdForPhase && collections[collectionIdForPhase]?.items?.length > 0 && (
                                  <button
                                    type="button"
                                    className="text-[11px] text-primary underline-offset-2 hover:underline ml-1"
                                    onClick={() => setShowDetailsMap((m) => ({ ...m, [objectiveId]: true }))}
                                  >
                                    Show all
                                  </button>
                                )}
                              </div>
                            )}
                          </ChainOfThoughtStep>
                        );
                      })}
                      </ChainOfThoughtContent>
                    </ChainOfThought>
                  )}

                  {showDetailsMap[objectiveId] && (
                    <ObjectiveDetails
                      objectiveId={objectiveId}
                      objective={objective}
                      phases={phases}
                      collections={state.collections || {}}
                      className="mt-1"
                    />
                  )}
                </TaskContent>
              </Task>
            );
          })}
        </div>

        {/* Global live status removed in favor of contextual per-objective items */}
      </div>
    </div>
  );
}

export default ResearchProgress;
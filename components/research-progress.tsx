// components/research-progress.tsx
"use client";

import { Activity, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import type {
  ResearchObjectiveData,
  ResearchState,
} from "@/lib/streaming-types";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ObjectiveDetails } from "@/components/research-objective-details";

interface ResearchProgressProps {
  state: ResearchState;
  className?: string;
}

export function ResearchProgress({ state, className }: ResearchProgressProps) {
  const { session, objectives, phases, currentOperation, searchProgress } = state;

  // Calculate actual progress based on objective progress
  const objectivesList = useMemo(() => Object.values(objectives), [objectives]);
  const overallProgress = objectivesList.length > 0
    ? (objectivesList.reduce((sum, obj) => sum + obj.progress, 0) / objectivesList.length) * 100
    : 0;

  // Local state for expand/collapse per objective (default: expanded)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const id of Object.keys(objectives)) map[id] = true;
    return map;
  });
  const toggleOpen = (id: string) => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  // Auto-expand new objectives as they appear
  const objectiveIds = useMemo(() => Object.keys(objectives), [objectives]);
  if (objectiveIds.some(id => openMap[id] === undefined)) {
    const next = { ...openMap };
    for (const id of objectiveIds) if (next[id] === undefined) next[id] = true;
    setOpenMap(next);
  }

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
              {Math.round(overallProgress)}%
            </div>
          </div>
        </div>

        {/* Main Progress Bar */}
        <div className="relative h-1.5 rounded-full overflow-hidden mb-4 bg-muted/30">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-primary via-primary/90 to-primary/70"
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
        <div className="space-y-2">
          {Object.entries(objectives).map(([objectiveId, objective]) => (
            <Collapsible key={objectiveId} open={!!openMap[objectiveId]} onOpenChange={() => toggleOpen(objectiveId)}>
              <ObjectiveCard
                objective={objective}
                onToggle={() => toggleOpen(objectiveId)}
                isOpen={!!openMap[objectiveId]}
              />
              <CollapsibleContent>
                <ObjectiveDetails
                  objectiveId={objectiveId}
                  objective={objective}
                  phases={phases}
                  className="mt-2"
                />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        {/* Live Status Section */}
        {(currentOperation || searchProgress) && (
          <div className="mt-3 pt-3 border-t border-border/30">
            {currentOperation && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                  <div className="w-1 h-1 bg-primary rounded-full animate-pulse animation-delay-150" />
                  <div className="w-1 h-1 bg-primary rounded-full animate-pulse animation-delay-300" />
                </div>
                <span>{currentOperation.message}</span>
              </div>
            )}

            {searchProgress && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="font-medium text-primary">
                  {searchProgress.resultsFound || 0}
                </span>
                <span>results found</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ObjectiveCardProps {
  objective: ResearchObjectiveData;
  onToggle?: () => void;
  isOpen?: boolean;
}

function ObjectiveCard({ objective, onToggle, isOpen }: ObjectiveCardProps) {

  const phaseLabels: Record<string, string> = {
    'query-generation': 'Generating',
    'searching': 'Searching',
    'deduplicating': 'Processing',
    'analyzing': 'Analyzing',
    'consolidating': 'Consolidating',
    'synthesizing': 'Synthesizing',
  };

  const getStatusColor = () => {
    switch (objective.status) {
      case 'complete':
        return 'bg-emerald-500';
      case 'failed':
        return 'bg-red-500';
      case 'active':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getCardStyle = () => {
    switch (objective.status) {
      case 'active':
        return 'border-primary/20 bg-primary/5 shadow-sm';
      case 'complete':
        return 'border-emerald-500/20 bg-emerald-500/5';
      case 'failed':
        return 'border-red-500/20 bg-red-500/5';
      default:
        return 'border-border/30';
    }
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border p-4",
        "bg-gradient-to-b from-background to-muted/10",
        "backdrop-blur-sm",
        "transition-all duration-200 hover:shadow-md",
        getCardStyle()
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Indicator */}
        <div className="relative mt-0.5">
          <div className={cn(
            "w-2 h-2 rounded-full",
            getStatusColor(),
            objective.status === 'active' && "animate-pulse"
          )} />
          {objective.status === 'active' && (
            <div className={cn(
              "absolute inset-0 w-2 h-2 rounded-full animate-ping",
              getStatusColor(),
              "opacity-75"
            )} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {/* Title with tiny avatar */}
            <div className="flex items-start gap-2 min-w-0">
              <div className="mt-0.5 h-5 w-5 shrink-0 rounded-md bg-primary/10 grid place-items-center">
                <span className="text-[10px] text-primary font-semibold">R</span>
              </div>
              <p className="text-[13.5px] font-medium leading-tight text-foreground line-clamp-2">
                {objective.objective}
              </p>
            </div>
            {/* Percent pill */}
            <span className="shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums text-foreground/80 transition-transform duration-300 will-change-transform" style={{ transform: `translateZ(0)` }}>
              {Math.round(objective.progress * 100)}%
            </span>
          </div>

          {/* Progress Section */}
          <div className="mt-2 space-y-1.5">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      objective.status === 'active' && "bg-gradient-to-r from-blue-500 to-blue-400",
                      objective.status === 'complete' && "bg-gradient-to-r from-emerald-500 to-emerald-400",
                      objective.status === 'failed' && "bg-red-500",
                      objective.status === 'pending' && "bg-gray-300"
                    )}
                    style={{ width: `${objective.progress * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Phase chip & stats */}
            <div className="flex items-center gap-3 text-[11px]">
              {objective.phase && (
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                  {phaseLabels[objective.phase]}
                </span>
              )}

              {objective.sourcesFound !== undefined && (
                <span className="text-muted-foreground">
                  <span className="font-medium">{objective.sourcesAnalyzed}</span>
                  <span className="text-muted-foreground/70">/{objective.sourcesFound}</span>
                  <span className="ml-1">sources</span>
                </span>
              )}
            </div>

            {/* Error Message */}
            {objective.error && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {objective.error}
              </p>
            )}
          </div>
        </div>

        {/* Expand Action */}
        <button
          type="button"
          onClick={onToggle}
          className="ml-2 rounded-md p-1 hover:bg-muted/30 transition-colors"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          )}
        </button>
      </div>
    </div>
  );
}

export default ResearchProgress;
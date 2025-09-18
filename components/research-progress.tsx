// components/research-progress.tsx
"use client";

import { Loader2, CheckCircle2, XCircle, AlertCircle, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type {
  ResearchObjectiveData,
  ResearchPhaseData,
  ResearchState,
} from "@/lib/streaming-types";

interface ResearchProgressProps {
  state: ResearchState;
  className?: string;
}

export function ResearchProgress({ state, className }: ResearchProgressProps) {
  const { session, objectives, phases, currentOperation, searchProgress } = state;

  // Don't show if no active research
  if (!session) {
    return null;
  }

  // Only show for active or starting research
  if (session.status !== 'starting' && session.status !== 'active') {
    return null;
  }

  return (
    <div className={cn(
      "mx-3 my-2",
      "relative overflow-hidden",
      "border border-border/50 bg-gradient-to-br from-background via-background to-muted/20",
      "rounded-xl shadow-sm",
      "animate-in slide-in-from-bottom-2 duration-500",
      className
    )}>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 animate-pulse" />

      <div className="relative p-4">
        {/* Session Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-primary/20 blur-xl" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">
                Research in Progress
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {session.completedObjectives} of {session.totalObjectives} objectives complete
              </p>
            </div>
          </div>

          {/* Overall Progress */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {Math.round((session.completedObjectives / session.totalObjectives) * 100)}%
            </span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(session.completedObjectives / session.totalObjectives) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Objectives List */}
        <div className="space-y-3">
          {Object.values(objectives).map((objective) => (
            <ObjectiveProgress key={objective.objective} objective={objective} phases={phases} />
          ))}
        </div>

        {/* Current Operation - Floating pill */}
        {currentOperation && (
          <div className="mt-3 animate-in slide-in-from-bottom-1 fade-in duration-300">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary rounded-full">
              <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
              <span className="text-xs font-medium">{currentOperation.message}</span>
            </div>
          </div>
        )}

        {/* Search Progress - Inline indicator */}
        {searchProgress && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="truncate">
              Searching: &quot;{searchProgress.query.substring(0, 40)}...&quot;
            </span>
            <span className="text-primary font-medium">
              {searchProgress.resultsFound || 0} found
            </span>
          </div>
        )}

        {/* Error State */}
        {session.error && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-destructive/10 rounded-lg animate-in slide-in-from-bottom-1">
            <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
            <span className="text-xs text-destructive">{session.error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ObjectiveProgressProps {
  objective: ResearchObjectiveData;
  phases: Record<string, ResearchPhaseData>;
}

function ObjectiveProgress({ objective }: ObjectiveProgressProps) {
  const [isExpanded, setIsExpanded] = useState(objective.status === 'active');

  const phaseNames: Record<string, string> = {
    'query-generation': 'Generating Queries',
    'searching': 'Searching',
    'deduplicating': 'Processing',
    'analyzing': 'Analyzing',
    'consolidating': 'Consolidating',
    'synthesizing': 'Synthesizing',
  };

  const phaseIcons: Record<string, string> = {
    'query-generation': '🔍',
    'searching': '🌐',
    'deduplicating': '⚙️',
    'analyzing': '📊',
    'consolidating': '📝',
    'synthesizing': '✨',
  };

  const getStatusIcon = () => {
    switch (objective.status) {
      case 'complete':
        return (
          <div className="relative">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div className="absolute inset-0 bg-emerald-500/20 blur-lg" />
          </div>
        );
      case 'failed':
        return (
          <div className="relative">
            <XCircle className="h-4 w-4 text-destructive" />
            <div className="absolute inset-0 bg-destructive/20 blur-lg" />
          </div>
        );
      case 'active':
        return (
          <div className="relative">
            <div className="h-4 w-4 rounded-full bg-gradient-to-tr from-primary to-primary/50 animate-pulse" />
            <div className="absolute inset-0 bg-primary/30 blur-lg animate-pulse" />
          </div>
        );
      default:
        return <div className="h-4 w-4 rounded-full bg-muted-foreground/20" />;
    }
  };

  return (
    <div className={cn(
      "group relative",
      "border border-border/40 bg-card/50 backdrop-blur-sm",
      "rounded-lg transition-all duration-300",
      objective.status === 'active' && "border-primary/30 bg-primary/5",
      objective.status === 'complete' && "border-emerald-500/20 bg-emerald-500/5",
      objective.status === 'failed' && "border-destructive/20 bg-destructive/5"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 text-left"
      >
        <div className="flex items-start gap-3">
          {/* Status Icon */}
          {getStatusIcon()}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium leading-tight line-clamp-2">
                {objective.objective}
              </h4>
              <ChevronRight className={cn(
                "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 mt-0.5",
                isExpanded && "rotate-90"
              )} />
            </div>

            {/* Progress Bar */}
            <div className="mt-2.5 space-y-1">
              <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out",
                    objective.status === 'active' && "bg-gradient-to-r from-primary via-primary/80 to-primary animate-shimmer",
                    objective.status === 'complete' && "bg-gradient-to-r from-emerald-500 to-emerald-400",
                    objective.status === 'failed' && "bg-gradient-to-r from-destructive to-destructive/80",
                    objective.status === 'pending' && "bg-muted-foreground/30"
                  )}
                  style={{ width: `${objective.progress * 100}%` }}
                />
              </div>

              {/* Phase & Stats */}
              {objective.phase && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs">{phaseIcons[objective.phase]}</span>
                    <span className="text-xs text-muted-foreground">
                      {phaseNames[objective.phase] || objective.phase}
                    </span>
                  </div>
                  {objective.sourcesFound !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {objective.sourcesAnalyzed}/{objective.sourcesFound} sources
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {isExpanded && objective.error && (
        <div className="px-3 pb-3 -mt-1">
          <div className="pl-7 text-xs text-destructive">
            {objective.error}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResearchProgress;
// components/research-progress.tsx
"use client";

import { Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type {
  ResearchObjectiveData,
  ResearchState,
} from "@/lib/streaming-types";

interface ResearchProgressProps {
  state: ResearchState;
  className?: string;
}

export function ResearchProgress({ state, className }: ResearchProgressProps) {
  const { session, objectives, currentOperation, searchProgress } = state;

  if (!session || (session.status !== 'starting' && session.status !== 'active')) {
    return null;
  }

  // Calculate actual progress based on objective progress
  const objectivesList = Object.values(objectives);
  const overallProgress = objectivesList.length > 0
    ? (objectivesList.reduce((sum, obj) => sum + obj.progress, 0) / objectivesList.length) * 100
    : 0;

  return (
    <div className={cn(
      "mx-3 my-3",
      "relative",
      "rounded-xl",
      "border border-border/50",
      "bg-gradient-to-b from-background to-muted/5",
      "shadow-sm",
      "overflow-hidden",
      "animate-in fade-in-50 slide-in-from-top-1 duration-500",
      className
    )}>
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

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
        <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden mb-4">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
          {/* Shimmer effect for active progress */}
          {overallProgress > 0 && overallProgress < 100 && (
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full"
              style={{ width: `${overallProgress}%` }}
            />
          )}
        </div>

        {/* Objectives List */}
        <div className="space-y-2">
          {Object.values(objectives).map((objective) => (
            <ObjectiveCard key={objective.objective} objective={objective} />
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
}

function ObjectiveCard({ objective }: ObjectiveCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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
        "group relative rounded-lg border p-3",
        "transition-all duration-200",
        "hover:shadow-md",
        getCardStyle()
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          {/* Title */}
          <p className="text-sm font-medium text-foreground leading-tight line-clamp-2 mb-2">
            {objective.objective}
          </p>

          {/* Progress Section */}
          <div className="space-y-2">
            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="h-1 bg-muted/20 rounded-full overflow-hidden">
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
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {Math.round(objective.progress * 100)}%
              </span>
            </div>

            {/* Phase & Stats */}
            {objective.status === 'active' && (
              <div className="flex items-center gap-3 text-xs">
                {objective.phase && (
                  <span className="text-primary font-medium">
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
            )}

            {/* Error Message */}
            {objective.error && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                {objective.error}
              </p>
            )}
          </div>
        </div>

        {/* Hover Action */}
        {isHovered && objective.status === 'active' && (
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-0.5 animate-in fade-in duration-200" />
        )}
      </div>
    </div>
  );
}

export default ResearchProgress;
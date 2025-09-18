// components/research-progress.tsx
"use client";

import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
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
    <div className={cn("mx-4 my-3 p-4 bg-muted/50 rounded-lg animate-in fade-in duration-300", className)}>
      {/* Session Header */}
      <div className="flex items-center gap-2 mb-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium text-sm">
          Research in Progress ({session.completedObjectives}/{session.totalObjectives} objectives)
        </span>
      </div>

      {/* Objectives Progress */}
      {Object.values(objectives).map((objective) => (
        <ObjectiveProgress key={objective.objective} objective={objective} phases={phases} />
      ))}

      {/* Current Operation */}
      {currentOperation && (
        <div className="mt-3 text-xs text-muted-foreground animate-in slide-in-from-bottom duration-200">
          {currentOperation.message}
        </div>
      )}

      {/* Search Progress */}
      {searchProgress && (
        <div className="mt-2 text-xs text-muted-foreground">
          Searching: &quot;{searchProgress.query.substring(0, 50)}...&quot; ({searchProgress.completed}/{searchProgress.total})
          {searchProgress.resultsFound !== undefined && ` - ${searchProgress.resultsFound} results`}
        </div>
      )}

      {/* Error State */}
      {session.error && (
        <div className="mt-3 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 mt-0.5" />
          <span>{session.error}</span>
        </div>
      )}
    </div>
  );
}

interface ObjectiveProgressProps {
  objective: ResearchObjectiveData;
  phases: Record<string, ResearchPhaseData>;
}

function ObjectiveProgress({ objective }: ObjectiveProgressProps) {
  const phaseNames: Record<string, string> = {
    'query-generation': 'Generating Queries',
    'searching': 'Searching',
    'deduplicating': 'Processing Results',
    'analyzing': 'Analyzing Content',
    'consolidating': 'Consolidating',
    'synthesizing': 'Synthesizing',
  };

  const getStatusIcon = () => {
    switch (objective.status) {
      case 'complete':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-destructive" />;
      case 'active':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      default:
        return <div className="h-3 w-3 rounded-full bg-muted-foreground/30" />;
    }
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {getStatusIcon()}
          <span className="text-sm font-medium truncate" title={objective.objective}>
            {objective.objective}
          </span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {Math.round(objective.progress * 100)}%
        </span>
      </div>

      <Progress value={objective.progress * 100} className="h-1.5" />

      {objective.phase && (
        <div className="text-xs text-muted-foreground pl-5">
          {phaseNames[objective.phase] || objective.phase}
          {objective.sourcesFound !== undefined && objective.sourcesAnalyzed !== undefined && (
            <span> • {objective.sourcesAnalyzed}/{objective.sourcesFound} sources analyzed</span>
          )}
        </div>
      )}

      {objective.error && (
        <div className="text-xs text-destructive pl-5">{objective.error}</div>
      )}
    </div>
  );
}

export default ResearchProgress;
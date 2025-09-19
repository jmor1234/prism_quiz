// components/research-objective-details.tsx
"use client";

import { cn } from "@/lib/utils";
import type { ResearchObjectiveData, ResearchPhaseData } from "@/lib/streaming-types";
import { AlertCircle, Check, Clock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface ObjectiveDetailsProps {
  objectiveId: string;
  objective: ResearchObjectiveData;
  phases: Record<string, ResearchPhaseData>;
  className?: string;
}

const PHASE_ORDER: Array<ResearchPhaseData["phase"]> = [
  "query-generation",
  "searching",
  "deduplicating",
  "analyzing",
  "consolidating",
  "synthesizing",
];

const PHASE_LABEL: Record<string, string> = {
  "query-generation": "Generating",
  "searching": "Searching",
  "deduplicating": "Processing",
  "analyzing": "Analyzing",
  "consolidating": "Consolidating",
  "synthesizing": "Synthesizing",
};

function formatDurationMs(start?: number, end?: number): string | null {
  if (!start) return null;
  const stop = end ?? Date.now();
  const ms = Math.max(0, stop - start);
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function ObjectiveDetails({ objectiveId, phases, className }: ObjectiveDetailsProps) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activePhaseKey = useMemo(() => {
    for (const phaseKey of PHASE_ORDER) {
      const id = `${objectiveId}-${phaseKey}`;
      const p = phases[id];
      if (p?.status === 'starting' || p?.status === 'active') return phaseKey;
    }
    return undefined;
  }, [objectiveId, phases]);

  useEffect(() => {
    if (!activePhaseKey) return;
    const el = rowRefs.current[activePhaseKey];
    if (el) {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    }
  }, [activePhaseKey]);

  const faviconFor = (domain?: string) => domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : undefined;

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/10",
        "px-3 py-3",
        "animate-in fade-in-50 duration-300",
        className
      )}
    >
      <div className="space-y-3">
        {PHASE_ORDER.map((phaseKey) => {
          const id = `${objectiveId}-${phaseKey}`;
          const p = phases[id];
          const status = p?.status ?? "pending";
          const isComplete = status === "complete";
          const isError = status === "error";
          const isActive = status === "starting" || status === "active";
          const progress = Math.round((p?.progress ?? 0) * 100);
          const duration = formatDurationMs(p?.startTime, p?.endTime);

          return (
            <div key={id} className="flex items-center gap-3" ref={(el) => { rowRefs.current[phaseKey] = el; }}>
              <div className="relative">
                {isComplete ? (
                  <div className="grid place-items-center h-5 w-5 rounded-full bg-emerald-500/90 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                ) : isError ? (
                  <div className="grid place-items-center h-5 w-5 rounded-full bg-red-500/90 text-white">
                    <AlertCircle className="h-3 w-3" />
                  </div>
                ) : isActive ? (
                  <div className="grid place-items-center h-5 w-5 rounded-full bg-blue-500/90 text-white animate-pulse">
                    <Clock className="h-3 w-3" />
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-border/60" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    {PHASE_LABEL[phaseKey]}
                  </div>
                  <div className="text-[10px] tabular-nums text-muted-foreground">
                    {duration ?? (isActive ? "…" : "")}
                  </div>
                </div>
                <div className="mt-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isError && "bg-red-500",
                      isComplete && "bg-gradient-to-r from-emerald-500 to-emerald-400",
                      isActive && "bg-gradient-to-r from-blue-500 to-blue-400",
                      !isActive && !isComplete && !isError && "bg-muted"
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {/* Search summary chips under Searching when completed */}
                {phaseKey === 'searching' && isComplete && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {p?.details?.summary && (
                      <div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <Sparkles className="h-3 w-3" />
                        <span>{p.details.summary.queries} queries → {p.details.summary.hits ?? '—'} hits → {p.details.summary.unique ?? '—'} unique</span>
                      </div>
                    )}
                    {p?.details?.samples && (
                      <div className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                        <span>{p.details.samples.length} sample domains</span>
                      </div>
                    )}
                  </div>
                )}
                {p?.details?.description && (
                  <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                    {p.details.description}
                  </div>
                )}
                {p?.details?.samples && p.details.samples.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {p.details.samples.slice(0, 6).map((s, i) => (
                      <a
                        key={`${id}-sample-${i}`}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[300px] truncate rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 inline-flex items-center gap-1"
                        title={s.title || s.url}
                      >
                        {s.domain && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={faviconFor(s.domain)} alt="" className="h-3 w-3 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <span className="truncate">
                          {s.domain ? s.domain : new URL(s.url).hostname}
                          {s.title ? ` — ${s.title}` : ''}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ObjectiveDetails;



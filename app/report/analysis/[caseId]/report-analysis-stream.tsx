// app/report/analysis/[caseId]/report-analysis-stream.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { ResearchState } from "@/lib/streaming-types";
import { ResearchProgress } from "@/components/research-progress";
import { ExtractionProgress } from "@/components/extraction-progress";
import { Response } from "@/components/ai-elements/response";
import { ToolStatus } from "@/components/ai-elements/tool-status";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ReportAnalysisStreamProps {
  caseId: string;
}

interface StreamEvent {
  type: string;
  data?: unknown;
  id?: string;
  transient?: boolean;
}

export function ReportAnalysisStream({ caseId }: ReportAnalysisStreamProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "streaming" | "complete" | "error"
  >("idle");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Research progress state (reuse from chat)
  const [researchState, setResearchState] = useState<ResearchState>({
    session: null,
    objectives: {},
    phases: {},
    currentOperation: null,
    searchProgress: null,
    lastError: null,
    currentToolStatus: null,
    extractionSession: null,
    extractionUrls: {},
    collections: {},
    sourcesByObjective: {},
  });

  // Tool status exit animation staging
  const [toolStatusExiting, setToolStatusExiting] = useState(false);
  const toolStatusExitStartRef = useRef<number | null>(null);
  const toolStatusRemoveRef = useRef<number | null>(null);

  // Fallback planning indicator (when no tool/session/extraction activity is visible)
  const [showPlanningIndicator, setShowPlanningIndicator] = useState(false);
  const [planningExiting, setPlanningExiting] = useState(false);
  const planningExitRef = useRef<number | null>(null);
  const planningRemoveRef = useRef<number | null>(null);
  const planningShowDelayRef = useRef<number | null>(null);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    const { type, data, id } = event;

    switch (type) {
      // Text streaming (custom event format)
      case "data-report-text":
        if (typeof data === "string") {
          setReportText((prev) => prev + data);
        }
        break;

      // Note: reasoning streaming removed - not useful for production reports

      // Research progress (same as chat)
      case "data-research-session":
        setResearchState((prev) => ({
          ...prev,
          session: data as ResearchState["session"],
        }));
        break;

      case "data-research-objective":
        if (id) {
          setResearchState((prev) => ({
            ...prev,
            objectives: {
              ...prev.objectives,
              [id]: data as ResearchState["objectives"][string],
            },
          }));
        }
        break;

      case "data-research-phase":
        if (id) {
          setResearchState((prev) => ({
            ...prev,
            phases: {
              ...prev.phases,
              [id]: data as ResearchState["phases"][string],
            },
          }));
        }
        break;

      case "data-tool-status":
        // Stage in → exit → remove for smooth transition
        try {
          // Clear any pending exit timers before scheduling new ones
          if (toolStatusExitStartRef.current) {
            clearTimeout(toolStatusExitStartRef.current);
            toolStatusExitStartRef.current = null;
          }
          if (toolStatusRemoveRef.current) {
            clearTimeout(toolStatusRemoveRef.current);
            toolStatusRemoveRef.current = null;
          }
        } catch {
          // Timer cleanup failed, continue
        }

        setResearchState((prev) => ({
          ...prev,
          currentToolStatus: data as ResearchState["currentToolStatus"],
        }));
        setToolStatusExiting(false);

        // Begin exit after a short display window
        toolStatusExitStartRef.current = window.setTimeout(() => {
          setToolStatusExiting(true);
        }, 1200);

        // Remove after exit animation completes
        toolStatusRemoveRef.current = window.setTimeout(() => {
          setResearchState((prev) => ({
            ...prev,
            currentToolStatus: null,
          }));
          setToolStatusExiting(false);
        }, 1600);
        break;

      case "data-research-operation":
        setResearchState((prev) => ({
          ...prev,
          currentOperation: data as ResearchState["currentOperation"],
        }));
        break;

      case "data-extraction-session":
        setResearchState((prev) => ({
          ...prev,
          extractionSession: data as ResearchState["extractionSession"],
        }));
        break;

      case "data-extraction-url":
        if (id) {
          setResearchState((prev) => ({
            ...prev,
            extractionUrls: {
              ...prev.extractionUrls,
              [id]: data as ResearchState["extractionUrls"][string],
            },
          }));
        }
        break;

      case "data-research-collection":
        if (id && data && typeof data === "object" && "items" in data) {
          const payload = data as {
            kind: string;
            action: "replace" | "append";
            total?: number;
            items: { url: string; title?: string; domain?: string }[];
          };
          setResearchState((prev) => {
            const existing = prev.collections?.[id];
            let items = payload.items;
            if (existing && payload.action === "append") {
              items = [...existing.items, ...payload.items];
            }
            const collections = prev.collections || {};
            return {
              ...prev,
              collections: {
                ...collections,
                [id]: {
                  kind: payload.kind as NonNullable<
                    ResearchState["collections"]
                  >[string]["kind"],
                  total: payload.total,
                  items,
                },
              },
            };
          });
        }
        break;

      case "data-research-sources":
        if (data && typeof data === "object" && "items" in data) {
          const payload = data as {
            objectiveId?: string;
            items: { url: string; title?: string; domain?: string }[];
          };
          const objId = payload.objectiveId ?? "session";
          setResearchState((prev) => {
            const existing = prev.sourcesByObjective?.[objId]?.items || [];
            const merged = [...existing, ...payload.items];
            return {
              ...prev,
              sourcesByObjective: {
                ...(prev.sourcesByObjective || {}),
                [objId]: { items: merged },
              },
            };
          });
        }
        break;
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    setStatus("streaming");
    setError(null);
    setReportText("");

    try {
      const response = await fetch("/api/report/phase1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Analysis failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6); // Remove 'data: ' prefix
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data) as StreamEvent;
            handleStreamEvent(parsed);
          } catch (e) {
            console.warn("Failed to parse SSE event:", e);
          }
        }
      }

      setStatus("complete");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Analysis stream error:", err);
    }
  }, [caseId, handleStreamEvent]);

  // Check for existing result first, then start analysis if needed
  useEffect(() => {
    if (status === "idle") {
      // First check if result already exists
      const checkExistingResult = async () => {
        try {
          setStatus("checking");
          const response = await fetch(`/api/report/phase1/result?caseId=${caseId}`);

          if (response.ok) {
            const data = await response.json() as { report: string };
            setReportText(data.report);
            setStatus("complete");
          } else if (response.status === 404) {
            // No existing result, start analysis
            startAnalysis();
          } else {
            throw new Error("Failed to check for existing result");
          }
        } catch (err) {
          console.warn("Could not check for existing result, starting analysis:", err);
          startAnalysis();
        }
      };

      checkExistingResult();
    }
  }, [status, startAnalysis, caseId]);

  // Compute planning indicator visibility (optimized to avoid re-render loops)
  const wasPlanningVisible = useRef(false);

  useEffect(() => {
    const shouldShow = (
      status === 'streaming' &&
      !researchState.currentToolStatus &&
      !researchState.session &&
      !researchState.extractionSession &&
      !reportText
    );

    // Only trigger if state actually changed
    if (shouldShow === wasPlanningVisible.current) return;

    wasPlanningVisible.current = shouldShow;

    // Clear existing timers
    [planningExitRef, planningRemoveRef, planningShowDelayRef].forEach(ref => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });

    if (shouldShow) {
      // Defer showing by 200ms to avoid flashing for very short gaps
      planningShowDelayRef.current = window.setTimeout(() => {
        setShowPlanningIndicator(true);
        setPlanningExiting(false);
      }, 200);
    } else if (showPlanningIndicator) {
      // Animate out gracefully
      setPlanningExiting(true);
      planningRemoveRef.current = window.setTimeout(() => {
        setShowPlanningIndicator(false);
        setPlanningExiting(false);
      }, 400);
    }
  }, [status, researchState.currentToolStatus, researchState.session, researchState.extractionSession, reportText, showPlanningIndicator]);

  if (status === "error") {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-destructive">
              Analysis Failed
            </p>
            <p className="text-sm text-destructive/80">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("idle");
                setError(null);
              }}
              className="mt-2"
            >
              Retry Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress UI */}
      {status === "streaming" && (
        <>
          {/* Fallback Planning Indicator */}
          {showPlanningIndicator && (
            <ToolStatus
              toolName="thinkTool"
              action="Analyzing client data…"
              exiting={planningExiting}
              variant="dots"
            />
          )}

          {/* Tool Status for think/memory/recommendation tools */}
          {researchState.currentToolStatus && (
            <ToolStatus
              toolName={researchState.currentToolStatus.toolName}
              action={researchState.currentToolStatus.action}
              exiting={toolStatusExiting}
            />
          )}

          {/* Research Progress */}
          {researchState.session && (
            <ResearchProgress state={researchState} />
          )}

          {/* Extraction Progress */}
          {researchState.extractionSession && (
            <ExtractionProgress
              session={researchState.extractionSession}
              urls={researchState.extractionUrls}
            />
          )}
        </>
      )}

      {/* Final Report */}
      {reportText && (
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Root Cause Analysis</h2>
          <Response>{reportText}</Response>
        </div>
      )}

      {/* Checking state */}
      {status === "checking" && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-6">
          <Loader className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">
            Loading analysis...
          </span>
        </div>
      )}

      {/* Note: "Initializing analysis..." loading state removed - planning indicator now handles this */}

      {/* Completion state */}
      {status === "complete" && reportText && (
        <div className="rounded-lg border border-success/50 bg-success/10 p-4">
          <p className="text-sm text-success-foreground">
            Analysis complete! Report generated successfully.
          </p>
        </div>
      )}
    </div>
  );
}

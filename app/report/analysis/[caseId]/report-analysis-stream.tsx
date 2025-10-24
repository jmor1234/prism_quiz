// app/report/analysis/[caseId]/report-analysis-stream.tsx

"use client";

import { useEffect, useState, useCallback } from "react";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface ReportAnalysisStreamProps {
  caseId: string;
}

export function ReportAnalysisStream({ caseId }: ReportAnalysisStreamProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "generating" | "complete" | "error"
  >("idle");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const startGeneration = useCallback(async () => {
    setStatus("generating");
    setError(null);

    try {
      console.log(`[Report] Starting generation for case: ${caseId}`);

      // POST to analyze endpoint - this will block until report is complete
      const response = await fetch("/api/report/phase1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Generation failed: ${response.statusText}`);
      }

      const result = await response.json() as { success: boolean; caseId: string };
      console.log(`[Report] Generation complete for case: ${result.caseId}`);

      // Report is saved to storage, now retrieve it
      const resultResponse = await fetch(`/api/report/phase1/result?caseId=${caseId}`);

      if (!resultResponse.ok) {
        throw new Error("Failed to retrieve generated report");
      }

      const resultData = await resultResponse.json() as { report: string };
      setReportText(resultData.report);
      setStatus("complete");

      console.log(`[Report] Report displayed successfully`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error during generation");
      console.error("[Report] Generation error:", err);
    }
  }, [caseId]);

  // Check for existing result first, then start generation if needed
  useEffect(() => {
    if (status === "idle") {
      const checkExistingResult = async () => {
        try {
          setStatus("checking");
          console.log(`[Report] Checking for existing result: ${caseId}`);

          const response = await fetch(`/api/report/phase1/result?caseId=${caseId}`);

          if (response.ok) {
            const data = await response.json() as { report: string };
            setReportText(data.report);
            setStatus("complete");
            console.log(`[Report] Loaded cached result for case: ${caseId}`);
          } else if (response.status === 404) {
            // No existing result, start generation
            console.log(`[Report] No cached result found, starting generation`);
            startGeneration();
          } else {
            throw new Error("Failed to check for existing result");
          }
        } catch (err) {
          console.warn("[Report] Could not check for existing result, starting generation:", err);
          startGeneration();
        }
      };

      checkExistingResult();
    }
  }, [status, startGeneration, caseId]);

  return (
    <div className="space-y-6">
      {/* Checking for existing result */}
      {status === "checking" && (
        <div className="flex items-center gap-3 rounded-lg border bg-card p-6">
          <Loader className="h-4 w-4" />
          <span className="text-sm text-muted-foreground">
            Checking for existing analysis...
          </span>
        </div>
      )}

      {/* Generating new report */}
      {status === "generating" && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start gap-3">
            <Loader className="h-5 w-5 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">Generating Report</p>
              <p className="text-sm text-muted-foreground">
                This typically takes 2-3 minutes. The system is analyzing client data, enriching directives, and gathering citations...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-destructive">
                Generation Failed
              </p>
              <p className="text-sm text-destructive/80">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("idle");
                  setError(null);
                  setReportText("");
                }}
                className="mt-2"
              >
                Retry Generation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete report */}
      {status === "complete" && reportText && (
        <>
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-600">
                Report generated successfully
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Root Cause Analysis</h2>
            <Response>{reportText}</Response>
          </div>
        </>
      )}
    </div>
  );
}

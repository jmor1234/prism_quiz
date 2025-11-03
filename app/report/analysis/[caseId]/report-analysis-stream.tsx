// app/report/analysis/[caseId]/report-analysis-stream.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, FileDown, Edit3, Save, X } from "lucide-react";

// Polling configuration
const POLLING_INTERVAL_MS = 10_000; // 10 seconds
const POLLING_TIMEOUT_MS = 900_000; // 15 minutes (100s buffer past 800s function max)

interface ReportAnalysisStreamProps {
  caseId: string;
}

export function ReportAnalysisStream({ caseId }: ReportAnalysisStreamProps) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "generating" | "complete" | "error"
  >("idle");
  const [reportText, setReportText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const isCheckingRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const pollForResult = useCallback(() => {
    console.log(`[Report] Starting polling for case: ${caseId}`);
    const startTime = Date.now();

    // Set up polling interval
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const elapsedMs = Date.now() - startTime;
        console.log(`[Report] Polling check (${Math.floor(elapsedMs / 1000)}s elapsed)`);

        const response = await fetch(`/api/report/phase1/result?caseId=${caseId}`);

        if (response.ok) {
          // Success - report is ready
          const data = await response.json() as { report: string };
          setReportText(data.report);
          setStatus("complete");
          console.log(`[Report] Report ready after ${Math.floor(elapsedMs / 1000)}s`);

          // Clear polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
        } else if (response.status === 404) {
          // Still generating - continue polling
          console.log(`[Report] Result not ready yet, continuing to poll...`);
        } else {
          throw new Error(`Unexpected status: ${response.status}`);
        }
      } catch (err) {
        console.error("[Report] Polling error:", err);
        // Continue polling on transient errors
      }
    }, POLLING_INTERVAL_MS);

    // Set up timeout to stop polling after max duration
    pollingTimeoutRef.current = setTimeout(() => {
      console.log(`[Report] Polling timeout after ${POLLING_TIMEOUT_MS / 1000}s`);
      
      // Clear polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      setStatus("error");
      setError(
        "Report generation timed out. This may indicate a backend error. Please try again."
      );
    }, POLLING_TIMEOUT_MS);
  }, [caseId]);

  const startGeneration = useCallback(() => {
    setStatus("generating");
    setError(null);

    console.log(`[Report] Initiating generation for case: ${caseId}`);

    // Fire-and-forget: POST to analyze endpoint without waiting for response
    // Backend will continue executing and save results even if connection closes
    fetch("/api/report/phase1/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    }).catch((err) => {
      // Ignore connection errors - backend continues executing
      console.log(`[Report] Analyze request connection closed (expected):`, err.message);
    });

    // Immediately start polling for results
    pollForResult();
  }, [caseId, pollForResult]);

  const downloadPdf = useCallback(async () => {
    setIsDownloadingPdf(true);

    try {
      console.log(`[PDF Download] Requesting PDF for case: ${caseId}`);

      const response = await fetch("/api/report/phase1/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `PDF generation failed: ${response.statusText}`);
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();

      // Extract filename from Content-Disposition header, fallback to caseId
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `prism-report-${caseId}.pdf`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log(`[PDF Download] Download triggered successfully`);
    } catch (err) {
      console.error("[PDF Download] Error:", err);
      alert(
        `Failed to download PDF: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [caseId]);

  const handleEdit = useCallback(() => {
    setEditedText(reportText);
    setIsEditing(true);
    console.log("[Report Edit] Entering edit mode");
  }, [reportText]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditedText("");
    console.log("[Report Edit] Cancelled edit mode");
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      console.log(`[Report Edit] Saving edited report for case: ${caseId}`);

      const response = await fetch("/api/report/phase1/result", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, report: editedText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `Save failed: ${response.statusText}`);
      }

      // Update display with edited text
      setReportText(editedText);
      setIsEditing(false);
      setEditedText("");

      console.log("[Report Edit] Save successful");
    } catch (err) {
      console.error("[Report Edit] Save error:", err);
      alert(
        `Failed to save changes: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsSaving(false);
    }
  }, [caseId, editedText]);

  // Check for existing result first, then start generation if needed
  useEffect(() => {
    // Only run if not already checking
    if (isCheckingRef.current) {
      return;
    }

    isCheckingRef.current = true;
    const checkAbortController = new AbortController();

    const checkExistingResult = async () => {
      try {
        setStatus("checking");
        console.log(`[Report] Checking for existing result: ${caseId}`);

        const response = await fetch(`/api/report/phase1/result?caseId=${caseId}`, {
          signal: checkAbortController.signal,
        });

        if (response.ok) {
          const data = await response.json() as { report: string };
          setReportText(data.report);
          setStatus("complete");
          console.log(`[Report] Loaded cached result for case: ${caseId}`);
        } else if (response.status === 404) {
          // No existing result, start generation
          console.log(`[Report] No cached result found, starting generation`);
          // Reset checking ref before starting generation
          isCheckingRef.current = false;
          startGeneration();
        } else {
          throw new Error("Failed to check for existing result");
        }
      } catch (err) {
        // Don't handle abort errors here - component unmounted
        if (err instanceof Error && err.name === "AbortError") {
          console.log(`[Report] Check aborted (component unmounted)`);
          return;
        }

        console.warn("[Report] Could not check for existing result, starting generation:", err);
        // Reset checking ref before starting generation
        isCheckingRef.current = false;
        startGeneration();
      }
    };

    checkExistingResult();

    // Cleanup: abort check request and clear polling if component unmounts or dependencies change
    return () => {
      checkAbortController.abort();
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Clear polling timeout
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      
      isCheckingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, retryTrigger]);

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
                This typically takes 6-12 minutes. The system is analyzing client data, enriching directives, and gathering citations...
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
                  isCheckingRef.current = false;
                  setRetryTrigger(prev => prev + 1);
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium text-green-600">
                  Report generated successfully
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader className="h-4 w-4" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEdit}
                      className="gap-2"
                    >
                      <Edit3 className="h-4 w-4" />
                      Edit Report
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadPdf}
                      disabled={isDownloadingPdf}
                      className="gap-2"
                    >
                      {isDownloadingPdf ? (
                        <>
                          <Loader className="h-4 w-4" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <FileDown className="h-4 w-4" />
                          Download PDF
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Root Cause Analysis</h2>
            {isEditing ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Edit the report markdown below. Changes will be saved and used for PDF generation.
                </p>
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[600px] font-mono text-sm"
                  disabled={isSaving}
                />
              </div>
            ) : (
              <Response variant="report">{reportText}</Response>
            )}
          </div>
        </>
      )}
    </div>
  );
}

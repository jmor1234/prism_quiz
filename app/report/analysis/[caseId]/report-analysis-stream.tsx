// app/report/analysis/[caseId]/report-analysis-stream.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, FileDown, Edit3, Save, X } from "lucide-react";

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
  const isCheckingRef = useRef(false);

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
    if (status === "idle" && !isCheckingRef.current) {
      isCheckingRef.current = true;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, caseId]);

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
                This typically takes 5-10 minutes. The system is analyzing client data, enriching directives, and gathering citations...
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

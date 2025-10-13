"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Upload, X, Download, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ErrorBanner } from "@/components/error-banner";

const STORAGE_KEYS = {
  questionnaire: "phase1.questionnaire",
  takehome: "phase1.takehome",
  advisor: "phase1.advisor",
} as const;

const MAX_FIELD_CHARS = 100_000;
const AUTOSAVE_MS = 1_000;

export function Phase1ReportForm() {
  const [questionnaireText, setQuestionnaireText] = useState("");
  const [takehomeText, setTakehomeText] = useState("");
  const [advisorNotesText, setAdvisorNotesText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [labs, setLabs] = useState<File[]>([]);

  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<string>("");
  const [restoredDraft, setRestoredDraft] = useState(false);

  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedQuestionnaire = window.localStorage.getItem(STORAGE_KEYS.questionnaire);
    const savedTakehome = window.localStorage.getItem(STORAGE_KEYS.takehome);
    const savedAdvisor = window.localStorage.getItem(STORAGE_KEYS.advisor);

    if (savedQuestionnaire || savedTakehome || savedAdvisor) {
      setQuestionnaireText(savedQuestionnaire ?? "");
      setTakehomeText(savedTakehome ?? "");
      setAdvisorNotesText(savedAdvisor ?? "");
      setRestoredDraft(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
      }
    };
  }, []);

  const scheduleAutosave = useCallback(
    (key: string, value: string) => {
      if (typeof window === "undefined") return;
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

      autosaveTimer.current = setTimeout(() => {
        window.localStorage.setItem(key, value);
      }, AUTOSAVE_MS);
    },
    [],
  );

  const handleQuestionnaireChange = (value: string) => {
    if (value.length > MAX_FIELD_CHARS) return;
    setQuestionnaireText(value);
    scheduleAutosave(STORAGE_KEYS.questionnaire, value);
  };

  const handleTakehomeChange = (value: string) => {
    if (value.length > MAX_FIELD_CHARS) return;
    setTakehomeText(value);
    scheduleAutosave(STORAGE_KEYS.takehome, value);
  };

  const handleAdvisorChange = (value: string) => {
    if (value.length > MAX_FIELD_CHARS) return;
    setAdvisorNotesText(value);
    scheduleAutosave(STORAGE_KEYS.advisor, value);
  };

  const handleFileInput = useCallback((files: FileList | null, type: "images" | "labs") => {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      return type === "images" ? isImage : isPdf;
    });

    if (!accepted.length) return;

    if (type === "images") {
      setImages((prev) => {
        const next = [...prev, ...accepted];
        return next.slice(0, 8);
      });
    } else {
      setLabs((prev) => {
        const next = [...prev, ...accepted];
        return next.slice(0, 5);
      });
    }
  }, []);

  const removeAttachment = useCallback((type: "images" | "labs", index: number) => {
    if (type === "images") {
      setImages((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setLabs((prev) => prev.filter((_, idx) => idx !== index));
    }
  }, []);

  const questionCharCount = questionnaireText.length;
  const takehomeCharCount = takehomeText.length;
  const advisorCharCount = advisorNotesText.length;

  const isSubmitDisabled =
    status === "submitting" || !questionnaireText.trim() || !takehomeText.trim() || !advisorNotesText.trim();

  const resetForm = () => {
    const hasContent =
      questionnaireText.trim().length || takehomeText.trim().length || advisorNotesText.trim().length;

    if (hasContent && !confirm("Clear all inputs? This will remove the current draft.")) {
      return;
    }

    setQuestionnaireText("");
    setTakehomeText("");
    setAdvisorNotesText("");
    setImages([]);
    setLabs([]);
    setResult("");
    setError(null);
    setStatus("idle");
    setRestoredDraft(false);

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.questionnaire);
      window.localStorage.removeItem(STORAGE_KEYS.takehome);
      window.localStorage.removeItem(STORAGE_KEYS.advisor);
    }
  };

  const copyResult = async () => {
    if (!result.trim()) return;
    try {
      await navigator.clipboard.writeText(result);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const downloadResult = () => {
    if (!result.trim()) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "phase1-root-cause.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    setResult("");

    try {
      const payload = {
        questionnaireText: questionnaireText.trim(),
        takehomeText: takehomeText.trim(),
        advisorNotesText: advisorNotesText.trim() || undefined,
        imageIds: images.length ? images.map((file) => file.name) : undefined,
        labIds: labs.length ? labs.map((file) => file.name) : undefined,
      } satisfies Record<string, unknown>;

      const response = await fetch("/api/reports/phase1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(errorBody || `Request failed with ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      let text = "";

      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (typeof data === "string") {
          text = data;
        } else if (typeof data?.report === "string") {
          text = data.report;
        } else if (typeof data?.result === "string") {
          text = data.result;
        } else {
          text = JSON.stringify(data, null, 2);
        }
      } else {
        text = await response.text();
      }

      setResult(text.trim());
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err : new Error("Unexpected error"));
    }
  };

  const guidanceBanner = useMemo(() => {
    if (!restoredDraft) return null;
    return (
      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Restored your saved draft. Review and update before generating a new report.
      </div>
    );
  }, [restoredDraft]);

  return (
    <section className="flex flex-col gap-8">
      <form
        className="space-y-8 rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-md transition-colors dark:bg-card/40"
        onSubmit={submitForm}
      >
        <div className="space-y-4">
          {guidanceBanner}

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor="questionnaire" className="text-sm font-medium">
                Client questionnaire <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">{questionCharCount.toLocaleString()} / {MAX_FIELD_CHARS.toLocaleString()}</span>
            </div>
            <Textarea
              id="questionnaire"
              value={questionnaireText}
              onChange={(event) => handleQuestionnaireChange(event.currentTarget.value)}
              minLength={1}
              rows={12}
              className="min-h-[220px] resize-y text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Paste the raw questionnaire export. Ratings of (1) are ignored during analysis.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor="takehome" className="text-sm font-medium">
                Take-home assessment <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">{takehomeCharCount.toLocaleString()} / {MAX_FIELD_CHARS.toLocaleString()}</span>
            </div>
            <Textarea
              id="takehome"
              value={takehomeText}
              onChange={(event) => handleTakehomeChange(event.currentTarget.value)}
              minLength={1}
              rows={10}
              className="min-h-[180px] resize-y text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Include the raw numeric entries, ratings, and any narrative responses.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor="advisor" className="text-sm font-medium">
                Advisor consultation notes <span className="text-destructive">*</span>
              </label>
              <span className="text-xs text-muted-foreground">{advisorCharCount.toLocaleString()} / {MAX_FIELD_CHARS.toLocaleString()}</span>
            </div>
            <Textarea
              id="advisor"
              value={advisorNotesText}
              onChange={(event) => handleAdvisorChange(event.currentTarget.value)}
              minLength={1}
              rows={8}
              className="min-h-[160px] resize-y text-sm leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              Required. Include the advisor's full notes—these shape the root-cause assessment.
            </p>
          </div>
        </div>

        <Separator className="bg-border/70" />

        <div className="grid gap-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Optional attachments</p>
              <p className="text-xs text-muted-foreground">
                Images and PDFs are stored for later phases. They are not processed in Phase 1 yet.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <AttachmentPicker
                id="attachments-images"
                label="Take-home images"
                description="JPEG, PNG. Up to 8 files."
                accept="image/*"
                onChange={(files) => handleFileInput(files, "images")}
              />
              <AttachmentPicker
                id="attachments-labs"
                label="Previous lab PDFs"
                description="PDF only. Up to 5 files."
                accept="application/pdf"
                onChange={(files) => handleFileInput(files, "labs")}
              />
            </div>

            <AttachmentList
              images={images}
              labs={labs}
              onRemove={removeAttachment}
            />
          </div>

          {error && (
            <ErrorBanner
              error={error}
              onRetry={() => {
                setError(null);
                setStatus("idle");
              }}
              onDismiss={() => setError(null)}
            />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-bio-root"></span>
                Root causes drive downstream recommendations
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-bio-energy"></span>
                Expect 20–40s processing time
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="ghost" onClick={resetForm} disabled={status === "submitting"}>
                Clear
              </Button>
              <Button type="submit" disabled={isSubmitDisabled} className="min-w-[200px]">
                {status === "submitting" ? (
                  <span className="flex items-center gap-2 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Generating analysis…
                  </span>
                ) : (
                  "Generate root-cause analysis"
                )}
              </Button>
            </div>
          </div>

          {status === "submitting" && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-bio-energy via-bio-consequence to-bio-symptom" />
            </div>
          )}
        </div>
      </form>
    </section>
  );
}

interface AttachmentPickerProps {
  id: string;
  label: string;
  description: string;
  accept: string;
  onChange: (files: FileList | null) => void;
}

function AttachmentPicker({ id, label, description, accept, onChange }: AttachmentPickerProps) {
  return (
    <label
      htmlFor={id}
      className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-dashed border-muted-foreground/40 bg-muted/20 p-4 text-sm transition-colors hover:border-muted-foreground hover:bg-muted/30"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-accent">
          <Upload className="size-4" />
        </span>
        <div className="flex flex-col">
          <span className="font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </div>
      <Input
        id={id}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => onChange(event.target.files)}
      />
    </label>
  );
}

interface AttachmentListProps {
  images: File[];
  labs: File[];
  onRemove: (type: "images" | "labs", index: number) => void;
}

function AttachmentList({ images, labs, onRemove }: AttachmentListProps) {
  if (!images.length && !labs.length) return null;

  const renderItem = (file: File, index: number, type: "images" | "labs") => {
    return (
      <li
        key={`${type}-${index}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-xs"
      >
        <div className="flex flex-col">
          <span className="font-medium text-foreground/90">
            {file.name.length > 42 ? `${file.name.slice(0, 39)}…` : file.name}
          </span>
          <span className="text-muted-foreground">
            {(file.size / (1024 * 1024)).toFixed(2)} MB
          </span>
        </div>
        <button
          type="button"
          onClick={() => onRemove(type, index)}
          className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${file.name}`}
        >
          <X className="size-3.5" />
        </button>
      </li>
    );
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Attached files
      </p>
      <ul className="mt-3 space-y-2">
        {images.map((file, index) => renderItem(file, index, "images"))}
        {labs.map((file, index) => renderItem(file, index, "labs"))}
      </ul>
    </div>
  );
}

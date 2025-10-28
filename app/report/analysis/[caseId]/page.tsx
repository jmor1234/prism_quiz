// app/report/analysis/[caseId]/page.tsx

"use client";

import { useParams } from "next/navigation";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { ReportAnalysisStream } from "./report-analysis-stream";

export default function AnalysisPage() {
  const params = useParams();
  const caseId = params?.caseId as string;

  if (!caseId) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-16 pt-10">
        <p className="text-sm text-muted-foreground">Invalid case ID</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-16 pt-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Client Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Case ID:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {caseId}
            </code>
          </p>
        </div>
        <div className="self-start shrink-0">
          <ModeToggle />
        </div>
      </header>

      <ReportAnalysisStream caseId={caseId} />
    </main>
  );
}

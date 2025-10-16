// app/report/page.tsx

import type { Metadata } from "next";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Phase1ReportForm } from "./phase1-form";

export const metadata: Metadata = {
  title: "Client Root Cause Report",
  description:
    "Compose and generate a personalized bioenergetic root-cause analysis for a client.",
};

export default function Phase1ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">Phase 1</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Client Root Cause Analysis
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Upload the client questionnaire, take-home assessment, and advisor notes to
            generate a concise root-cause narrative that anchors downstream recommendations.
          </p>
        </div>
        <div className="self-start shrink-0">
          <ModeToggle />
        </div>
      </header>

      <Phase1ReportForm />
    </main>
  );
}

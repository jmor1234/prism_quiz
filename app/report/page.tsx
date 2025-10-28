// app/report/page.tsx

import type { Metadata } from "next";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Phase1ReportForm } from "./phase1-form";

export const metadata: Metadata = {
  title: "Client Report",
  description:
    "Generate a personalized bioenergetic health report for a client.",
};

export default function Phase1ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Client Report
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Upload the client questionnaire, take-home assessment, and advisor notes to
            generate a personalized health report.
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

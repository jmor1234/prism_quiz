"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </div>

            <h1 className="mb-2 text-2xl font-semibold">Critical Error</h1>

            <p className="mb-6 text-gray-600 dark:text-gray-400">
              A critical error occurred and the application couldn&apos;t recover. Please refresh the page.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={reset}
                className="bg-black text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Try again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-gray-300 dark:border-gray-700"
              >
                Refresh page
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
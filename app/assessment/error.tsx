"use client";

export default function AssessmentError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-4">
        <p className="text-lg font-medium">Something went wrong</p>
        <p className="text-sm text-muted-foreground">
          Please try again or refresh the page.
        </p>
        <button
          onClick={reset}
          className="text-sm underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

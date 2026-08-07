// app/api/agent/lib/toolFailure.ts
//
// Makes evidence-tool failures visible.
//
// Every tool logs only on success — the console.log sits after the await — so
// a failing evidence layer produced no output whatsoever. The agent degrades
// gracefully when a tool fails (the system prompt forbids citing anything the
// tools didn't return, so it writes without citations rather than inventing
// them), which is the right product behavior but means a total outage looks
// identical to a healthy run.
//
// That combination is not hypothetical: an expired Exa key stripped citations
// from generated assessments while every request still returned 200, and the
// only trace was "~0 tok to agent" in a summary line.

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);

  // Exa (and most HTTP clients) attach a status; surface it, since 401 vs 429
  // vs 500 is the difference between a dead key, a rate limit, and an outage.
  const status =
    (error as { statusCode?: number }).statusCode ??
    (error as { status?: number }).status;

  return `${error.name}${status ? ` ${status}` : ""}: ${error.message}`;
}

/**
 * Run an external tool call, logging loudly if it fails.
 *
 * Rethrows rather than swallowing: the agent's existing handling of a failed
 * tool call is what we want, and returning a fake empty result would trade one
 * silent failure for another. Only the silence is being fixed.
 *
 * Failures are greppable as `FAILED`.
 */
export async function reportFailure<T>(
  label: string,
  context: string,
  run: () => Promise<T>
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[${label}] FAILED ${context} — ${describe(error)}`);
    throw error;
  }
}

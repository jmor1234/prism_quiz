// app/api/report/phase1/lib/asyncContext.ts

import { asyncLocalStorage } from "@/app/api/chat/lib/traceLogger";
import type { Phase1Submission } from "@/lib/schemas/phase1";

/**
 * Get the Phase1Submission from the current async context.
 * Only available when set by the analyze route.
 */
export function getSubmission(): Phase1Submission | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.submission as Phase1Submission | undefined;
}

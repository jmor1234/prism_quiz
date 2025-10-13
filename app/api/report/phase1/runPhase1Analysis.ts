import { getPhase1Case } from "@/server/phase1Cases";

import { composePhase1Prompt } from "./composePrompt";
import { runPhase1Agent } from "./agent";
import { getPhase1Result, savePhase1Result } from "./persistence";

export interface Phase1AnalysisOptions {
  currentDate?: string;
  force?: boolean;
}

export interface Phase1AnalysisResult {
  caseId: string;
  createdAt: string;
  rootCauseReport: string;
}

export async function runPhase1Analysis(
  caseId: string,
  options: Phase1AnalysisOptions = {},
): Promise<Phase1AnalysisResult> {
  const caseRecord = await getPhase1Case(caseId);
  if (!caseRecord) {
    throw new Error(`Phase 1 submission not found for caseId ${caseId}`);
  }

  if (!options.force) {
    const existing = await getPhase1Result(caseId);
    if (existing) {
      return existing;
    }
  }

  const prompt = await composePhase1Prompt(caseRecord, { currentDate: options.currentDate });
  const { rootCauseReport } = await runPhase1Agent(prompt);

  const record: Phase1AnalysisResult = {
    caseId,
    createdAt: new Date().toISOString(),
    rootCauseReport,
  };

  await savePhase1Result(record);

  return record;
}

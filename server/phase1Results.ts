// server/phase1Results.ts

import { promises as fs } from "node:fs";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "phase1-results");

export interface Phase1Result {
  caseId: string;
  createdAt: string;
  report: string;
  version?: number;
}

export async function savePhase1Result({
  caseId,
  report,
}: {
  caseId: string;
  report: string;
}): Promise<Phase1Result> {
  const timestamp = new Date().toISOString();

  const result: Phase1Result = {
    caseId,
    createdAt: timestamp,
    report,
    version: 1,
  };

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, `${caseId}.json`);
  await fs.writeFile(filePath, JSON.stringify(result, null, 2), "utf8");

  return result;
}

export async function getPhase1Result(
  caseId: string,
): Promise<Phase1Result | null> {
  try {
    const filePath = path.join(STORAGE_ROOT, `${caseId}.json`);
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as Phase1Result;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

const isNotFoundError = (error: unknown): error is NodeJS.ErrnoException => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
};

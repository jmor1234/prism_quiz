import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { Phase1Submission } from "@/lib/schemas/phase1";

const STORAGE_ROOT = path.join(process.cwd(), "storage", "phase1-submissions");

export interface Phase1CaseRecord {
  caseId: string;
  createdAt: string;
  updatedAt: string;
  submission: Phase1Submission;
}

export async function upsertPhase1Case({
  submission,
}: {
  submission: Phase1Submission;
}): Promise<Phase1CaseRecord> {
  const caseId = randomUUID();
  const timestamp = new Date().toISOString();

  const record: Phase1CaseRecord = {
    caseId,
    createdAt: timestamp,
    updatedAt: timestamp,
    submission,
  };

  await fs.mkdir(STORAGE_ROOT, { recursive: true });
  const filePath = path.join(STORAGE_ROOT, `${caseId}.json`);
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");

  return record;
}


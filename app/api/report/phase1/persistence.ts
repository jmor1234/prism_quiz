import { promises as fs } from "node:fs";
import path from "node:path";

export interface Phase1ResultRecord {
  caseId: string;
  createdAt: string;
  rootCauseReport: string;
}

const RESULTS_ROOT = path.join(process.cwd(), "storage", "phase1-results");

const resultFilePath = (caseId: string) => path.join(RESULTS_ROOT, `${caseId}.json`);

export async function savePhase1Result(record: Phase1ResultRecord): Promise<void> {
  await fs.mkdir(RESULTS_ROOT, { recursive: true });
  await fs.writeFile(resultFilePath(record.caseId), JSON.stringify(record, null, 2), "utf8");
}

export async function getPhase1Result(caseId: string): Promise<Phase1ResultRecord | null> {
  try {
    const raw = await fs.readFile(resultFilePath(caseId), "utf8");
    return JSON.parse(raw) as Phase1ResultRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

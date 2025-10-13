import { promises as fs } from "node:fs";
import path from "node:path";

const DATA_ROOT = path.join(process.cwd(), "app", "api", "chat", "data");

const knowledgePath = path.join(DATA_ROOT, "knowledge.md");
const questionnairePath = path.join(DATA_ROOT, "questionaire.md");
const takehomePath = path.join(DATA_ROOT, "takehome.md");

let cachedKnowledge: string | null = null;
let cachedQuestionnaire: string | null = null;
let cachedTakehome: string | null = null;

export async function loadBioenergeticKnowledge(): Promise<string> {
  if (cachedKnowledge) return cachedKnowledge;
  cachedKnowledge = await fs.readFile(knowledgePath, "utf8");
  return cachedKnowledge;
}

export async function loadQuestionnaireImplications(): Promise<string> {
  if (cachedQuestionnaire) return cachedQuestionnaire;
  cachedQuestionnaire = await fs.readFile(questionnairePath, "utf8");
  return cachedQuestionnaire;
}

export async function loadTakehomeInterpretations(): Promise<string> {
  if (cachedTakehome) return cachedTakehome;
  cachedTakehome = await fs.readFile(takehomePath, "utf8");
  return cachedTakehome;
}

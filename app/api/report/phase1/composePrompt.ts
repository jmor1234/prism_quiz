import type { Phase1CaseRecord } from "@/server/phase1Cases";

import {
  loadBioenergeticKnowledge,
  loadQuestionnaireImplications,
  loadTakehomeInterpretations,
} from "./decisionData";

const DEFAULT_CURRENT_DATE = () =>
  new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export interface ComposePhase1PromptOptions {
  currentDate?: string;
}

export async function composePhase1Prompt(
  caseRecord: Phase1CaseRecord,
  options: ComposePhase1PromptOptions = {},
): Promise<string> {
  const [knowledge, questionnaireImplications, takehomeInterpretations] = await Promise.all([
    loadBioenergeticKnowledge(),
    loadQuestionnaireImplications(),
    loadTakehomeInterpretations(),
  ]);

  const { submission } = caseRecord;
  const currentDate = options.currentDate ?? DEFAULT_CURRENT_DATE();

  return `${knowledge}

You are the Phase 1 root-cause analyst for personalized bioenergetic reports.
Your task: map the client’s data to the cascades of root causes → energy disruptions → consequences → manifestations.

Decision data:
--- Questionnaire Implications ---
${questionnaireImplications}

--- Take-home Interpretations ---
${takehomeInterpretations}

Client submission (case ${caseRecord.caseId}):
Current Date: ${currentDate}

### Questionnaire
${submission.questionnaireText}

### Take-home Assessment
${submission.takehomeText}

### Advisor Consultation Notes
${submission.advisorNotesText}
`;
}

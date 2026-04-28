// lib/quiz/types.ts

// --- Option config (shared by multi_select, single_select, and yes_no follow-ups) ---

export interface OptionConfig {
  value: string;
  label: string; // displayed in UI
  promptLabel?: string; // used in formatAnswers for prompt (defaults to label.toLowerCase())
}

// --- Conditional display ---

// When set, the question is skipped in the wizard if the referenced
// upstream question's answer matches one of the listed values. The wizard
// auto-fills this question's answer with `setAnswerTo` when hidden, so
// schema validation and prompt formatting continue to work unchanged.
//
// The referenced question MUST appear earlier in `variant.questions` than
// the question carrying this rule (forward references will never trigger).
export interface HideWhenConfig {
  questionId: string;
  is: string | string[];
  setAnswerTo: unknown;
}

// --- Question type configs ---

export interface SliderQuestionConfig {
  type: "slider";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  min: number;
  max: number;
  default: number;
  lowLabel: string;
  highLabel: string;
  qualifiers?: { max: number; label: string }[];
}

export interface YesNoQuestionConfig {
  type: "yes_no";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  // When true, renders a third "Unsure" button alongside Yes/No. The answer
  // value widens to include the literal "unsure".
  allowUnsure?: boolean;
  conditionalFollowUp?: {
    prompt: string;
    options: OptionConfig[];
  };
}

export interface MultiSelectQuestionConfig {
  type: "multi_select";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  options: OptionConfig[];
  required?: boolean; // default true
  allowOther?: boolean; // default true — set false to disable
}

export interface SingleSelectQuestionConfig {
  type: "single_select";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  options: OptionConfig[];
  allowOther?: boolean; // default true — set false to disable
}

export interface FreeTextQuestionConfig {
  type: "free_text";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  placeholder: string;
  rows?: number; // default 4
  required?: boolean; // default true
}

export interface YesNoWithTextQuestionConfig {
  type: "yes_no_with_text";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  hideWhen?: HideWhenConfig;
  // When true, renders a third "Unsure" button. Textarea remains visible
  // for both Yes and Unsure (hidden only on No), since notes are useful
  // when the user picks "Unsure" too.
  allowUnsure?: boolean;
  textPrompt?: string; // hint shown above the textarea (e.g., "If yes, please list…")
  placeholder?: string;
  rows?: number; // default 3
}

export type QuestionConfig =
  | SliderQuestionConfig
  | YesNoQuestionConfig
  | MultiSelectQuestionConfig
  | SingleSelectQuestionConfig
  | FreeTextQuestionConfig
  | YesNoWithTextQuestionConfig;

// --- Variant config ---

export interface VariantConfig {
  // Identity
  slug: string;
  name: string;
  description: string;

  // Questions (ordered — each becomes one wizard step)
  questions: QuestionConfig[];
  nameField: {
    question: string;
    hint: string;
    placeholder?: string;
  };

  // Landing / UI copy
  headline: string;
  subtitle?: string;
  resultBanner: string;
  ctaText: string;
  ctaUrl: string;

  // Prompt
  promptOverlay: string; // variant-specific guidance injected into system prompt

  // When true, omit from public /quiz index and admin variant filters.
  // The variant route (/quiz/{slug}) still works; this only affects listings.
  hidden?: boolean;
}

// --- Answer types ---

// Tri-state for yes_no questions that opt in to allowUnsure.
// Two-state questions only ever produce true/false/null.
export type YesNoAnswer = boolean | "unsure" | null;

export type YesNoWithFollowUp = {
  answer: YesNoAnswer;
  followUp: string[];
};

export type YesNoWithText = {
  answer: YesNoAnswer;
  text: string;
};

export type QuizAnswers = Record<string, unknown>;

// --- Submission payload (what the client sends) ---

export interface QuizSubmissionPayload {
  variant: string;
  name: string;
  answers: QuizAnswers;
}

// --- Storage record (what gets persisted) ---

export interface QuizSubmissionRecord {
  id: string;
  createdAt: string;
  variant: string;
  name: string;
  answers: QuizAnswers;
}

export interface QuizEntry {
  id: string;
  createdAt: string;
  variant: string;
  name: string;
  answers: QuizAnswers;
  report: string | null;
}

export interface ListQuizEntriesResult {
  entries: QuizEntry[];
  nextCursor: string | null;
}

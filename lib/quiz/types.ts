// lib/quiz/types.ts

// --- Option config (shared by multi_select, single_select, and yes_no follow-ups) ---

export interface OptionConfig {
  value: string;
  label: string; // displayed in UI
  promptLabel?: string; // used in formatAnswers for prompt (defaults to label.toLowerCase())
}

// --- Question type configs ---

export interface SliderQuestionConfig {
  type: "slider";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
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
  options: OptionConfig[];
  required?: boolean; // default true
}

export interface SingleSelectQuestionConfig {
  type: "single_select";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  options: OptionConfig[];
}

export interface FreeTextQuestionConfig {
  type: "free_text";
  id: string;
  question: string;
  hint?: string;
  promptLabel?: string;
  placeholder: string;
  rows?: number; // default 4
  required?: boolean; // default true
}

export type QuestionConfig =
  | SliderQuestionConfig
  | YesNoQuestionConfig
  | MultiSelectQuestionConfig
  | SingleSelectQuestionConfig
  | FreeTextQuestionConfig;

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
}

// --- Answer types ---

export type YesNoWithFollowUp = {
  answer: boolean | null;
  followUp: string[];
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

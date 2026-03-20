"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import type { IntakeStep } from "@/app/api/assessment/types";
import {
  getAssessmentStorage,
  setAssessmentStorage,
  clearAssessmentStorage,
} from "@/lib/assessmentStorage";

// --- Static Question Configuration ---

type QuestionConfig = {
  question: string;
  options: { value: string; label: string }[];
  placeholder: string;
  multiSelect: boolean;
};

export const ASSESSMENT_QUESTIONS: QuestionConfig[] = [
  {
    question: "What have you been dealing with?",
    options: [
      { value: "energy", label: "Low energy or fatigue" },
      { value: "digestion", label: "Digestive issues" },
      { value: "sleep", label: "Trouble sleeping" },
      { value: "weight", label: "Stubborn weight" },
      { value: "brain_fog", label: "Brain fog" },
      { value: "mood", label: "Mood or anxiety" },
      { value: "hormones", label: "Hormonal imbalances" },
      { value: "skin", label: "Skin issues" },
      { value: "allergies", label: "Allergies or sensitivities" },
      { value: "pain", label: "Pain or inflammation" },
    ],
    placeholder: "Tell us more about what you're experiencing...",
    multiSelect: true,
  },
  {
    question: "What have you tried so far?",
    options: [
      { value: "supplements", label: "Supplements or vitamins" },
      { value: "diet", label: "Dietary changes" },
      { value: "prescription", label: "Prescription medications" },
      { value: "lab_testing", label: "Blood work or lab testing" },
      { value: "doctors", label: "Doctors or specialists" },
      { value: "functional", label: "Functional or alternative medicine" },
      { value: "self_research", label: "Online research on my own" },
      { value: "nothing", label: "Nothing yet" },
    ],
    placeholder: "Any specific diets, supplements, or treatments you've tried...",
    multiSelect: true,
  },
  {
    question: "How long has this been going on?",
    options: [
      { value: "less_6mo", label: "Less than 6 months" },
      { value: "6mo_1yr", label: "6 months to 1 year" },
      { value: "1_3yr", label: "1\u20133 years" },
      { value: "3_5yr", label: "3\u20135 years" },
      { value: "5yr_plus", label: "Over 5 years" },
    ],
    placeholder: "Do you remember what triggered it or when it started?",
    multiSelect: false,
  },
  {
    question: "Where are things at right now?",
    options: [
      { value: "getting_worse", label: "Getting worse over time" },
      { value: "stuck", label: "Stuck in the same place" },
      { value: "up_and_down", label: "Some good days, some bad days" },
      { value: "nothing_lasting", label: "Tried a lot, nothing lasting" },
      { value: "daily_life", label: "Affects my daily life" },
      { value: "overwhelmed", label: "Overwhelmed, not sure where to turn" },
    ],
    placeholder: "How is this affecting your life right now?",
    multiSelect: true,
  },
  {
    question: "Do you feel like you can figure this out on your own?",
    options: [
      { value: "need_guidance", label: "No, I need expert guidance" },
      { value: "probably_not", label: "Probably not on my own" },
      { value: "not_sure", label: "I'm not sure anymore" },
      { value: "maybe_difficult", label: "I think so, but it's been difficult" },
      { value: "yes_info", label: "Yes, I just need the right info" },
    ],
    placeholder: "Anything else you want us to know?",
    multiSelect: false,
  },
];

const TOTAL_QUESTIONS = ASSESSMENT_QUESTIONS.length;

// --- Types ---

export type WizardPhase =
  | "intro"
  | "answering"
  | "generating"
  | "result"
  | "error";

export type WizardState = {
  phase: WizardPhase;
  steps: IntakeStep[];
  answers: { selectedOptions: string[]; freeText: string }[];
  selectedOptions: string[];
  freeText: string;
  stepIndex: number;
  direction: "forward" | "back";
  error: string | null;
  result: { id: string; report: string } | null;
  isHydrated: boolean;
};

// --- Actions ---

type WizardAction =
  | { type: "HYDRATE"; state: Partial<WizardState> }
  | { type: "START" }
  | { type: "TOGGLE_OPTION"; value: string }
  | { type: "SET_FREE_TEXT"; text: string }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "START_GENERATING" }
  | { type: "GENERATE_SUCCESS"; id: string; report: string }
  | { type: "GENERATE_ERROR"; error: string }
  | { type: "RESET" };

// --- Reducer ---

const initialState: WizardState = {
  phase: "intro",
  steps: [],
  answers: [],
  selectedOptions: [],
  freeText: "",
  stepIndex: 0,
  direction: "forward",
  error: null,
  result: null,
  isHydrated: false,
};

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.state, isHydrated: true };

    case "START":
      return { ...state, phase: "answering", direction: "forward", stepIndex: 0 };

    case "TOGGLE_OPTION": {
      const q = ASSESSMENT_QUESTIONS[state.stepIndex];
      const alreadySelected = state.selectedOptions.includes(action.value);
      let selected: string[];
      if (q.multiSelect) {
        selected = alreadySelected
          ? state.selectedOptions.filter((v) => v !== action.value)
          : [...state.selectedOptions, action.value];
      } else {
        selected = alreadySelected ? [] : [action.value];
      }
      return { ...state, selectedOptions: selected };
    }

    case "SET_FREE_TEXT":
      return { ...state, freeText: action.text };

    case "NEXT": {
      const q = ASSESSMENT_QUESTIONS[state.stepIndex];
      const currentAnswer = {
        selectedOptions: state.selectedOptions,
        freeText: state.freeText,
      };
      const newStep: IntakeStep = {
        question: q.question,
        selectedOptions: state.selectedOptions,
        freeText: state.freeText,
      };

      // Save answer and step
      const newAnswers = [...state.answers];
      newAnswers[state.stepIndex] = currentAnswer;
      const newSteps = [...state.steps.slice(0, state.stepIndex), newStep];

      if (state.stepIndex === TOTAL_QUESTIONS - 1) {
        // Last question — go straight to generating
        return {
          ...state,
          phase: "generating",
          steps: newSteps,
          answers: newAnswers,
          direction: "forward",
        };
      }

      // Load next question's saved answer or reset
      const nextAnswer = newAnswers[state.stepIndex + 1];
      return {
        ...state,
        steps: newSteps,
        answers: newAnswers,
        stepIndex: state.stepIndex + 1,
        selectedOptions: nextAnswer?.selectedOptions ?? [],
        freeText: nextAnswer?.freeText ?? "",
        direction: "forward",
      };
    }

    case "BACK": {
      if (state.stepIndex === 0) {
        return { ...state, phase: "intro", direction: "back" };
      }

      // Save current answer before going back
      const currentAnswer = {
        selectedOptions: state.selectedOptions,
        freeText: state.freeText,
      };
      const updatedAnswers = [...state.answers];
      updatedAnswers[state.stepIndex] = currentAnswer;

      const prevAnswer = updatedAnswers[state.stepIndex - 1];
      return {
        ...state,
        answers: updatedAnswers,
        stepIndex: state.stepIndex - 1,
        selectedOptions: prevAnswer?.selectedOptions ?? [],
        freeText: prevAnswer?.freeText ?? "",
        direction: "back",
      };
    }

    case "START_GENERATING":
      return { ...state, phase: "generating" };

    case "GENERATE_SUCCESS":
      return {
        ...state,
        phase: "result",
        result: { id: action.id, report: action.report },
      };

    case "GENERATE_ERROR":
      return {
        ...state,
        phase: "error",
        error: action.error,
      };

    case "RESET":
      return { ...initialState, isHydrated: true };

    default:
      return state;
  }
}

// --- Persistence helper ---

function persist(
  state: WizardState,
  pendingResultId?: string,
) {
  setAssessmentStorage({
    name: "",
    steps: state.steps,
    answers: state.answers,
    stepIndex: state.stepIndex,
    resultId: pendingResultId,
    result: state.result ?? undefined,
  });
}

// --- Hook ---

export function useAssessmentWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pendingResultId = useRef<string | undefined>(undefined);

  // Stable ref to current state for async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Hydrate from localStorage ---

  useEffect(() => {
    const stored = getAssessmentStorage();
    if (stored) {
      // Completed result
      if (stored.result) {
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "result",
            steps: stored.steps,
            answers: stored.answers,
            result: stored.result,
            stepIndex: stored.stepIndex,
          },
        });
        return;
      }

      // Interrupted generation
      if (stored.resultId) {
        pendingResultId.current = stored.resultId;
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "error",
            steps: stored.steps,
            answers: stored.answers,
            stepIndex: stored.stepIndex,
            error: "Your assessment generation was interrupted. Click retry to continue.",
          },
        });
        return;
      }

      // In-progress answering — resume at the step they were on
      if (stored.answers.length > 0) {
        const idx = Math.min(stored.stepIndex, TOTAL_QUESTIONS - 1);
        const answer = stored.answers[idx];
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "answering",
            steps: stored.steps,
            answers: stored.answers,
            stepIndex: idx,
            selectedOptions: answer?.selectedOptions ?? [],
            freeText: answer?.freeText ?? "",
          },
        });
        return;
      }
    }

    dispatch({ type: "HYDRATE", state: {} });
  }, []);

  // --- Async: generate assessment ---

  const generateAssessment = useCallback(async (steps: IntakeStep[]) => {
    try {
      const payload: Record<string, unknown> = { steps };
      if (pendingResultId.current) payload.resultId = pendingResultId.current;

      const res = await fetch("/api/assessment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.id) pendingResultId.current = data.id;
        throw new Error(
          data.error || `Assessment generation failed (${res.status})`
        );
      }

      const data = await res.json();
      pendingResultId.current = undefined;

      dispatch({ type: "GENERATE_SUCCESS", id: data.id, report: data.report });

      persist(
        { ...stateRef.current, result: { id: data.id, report: data.report } },
        undefined
      );
    } catch (err) {
      dispatch({
        type: "GENERATE_ERROR",
        error: err instanceof Error ? err.message : "Something went wrong",
      });

      persist(stateRef.current, pendingResultId.current);
    }
  }, []);

  // --- Synchronous action wrappers ---

  const start = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const toggleOption = useCallback((value: string) => {
    dispatch({ type: "TOGGLE_OPTION", value });
  }, []);

  const setFreeText = useCallback((text: string) => {
    dispatch({ type: "SET_FREE_TEXT", text });
  }, []);

  const next = useCallback(() => {
    // Check if this is the last question — if so, trigger generation after dispatch
    const s = stateRef.current;
    const isLastQuestion = s.stepIndex === TOTAL_QUESTIONS - 1;

    dispatch({ type: "NEXT" });

    if (isLastQuestion) {
      // Build the final steps array (same logic as reducer)
      const q = ASSESSMENT_QUESTIONS[s.stepIndex];
      const newStep: IntakeStep = {
        question: q.question,
        selectedOptions: s.selectedOptions,
        freeText: s.freeText,
      };
      const finalSteps = [...s.steps.slice(0, s.stepIndex), newStep];
      persist(stateRef.current);
      generateAssessment(finalSteps);
    } else {
      queueMicrotask(() => persist(stateRef.current));
    }
  }, [generateAssessment]);

  const back = useCallback(() => {
    dispatch({ type: "BACK" });
    queueMicrotask(() => persist(stateRef.current));
  }, []);

  const retry = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "error") {
      dispatch({ type: "START_GENERATING" });
      generateAssessment(s.steps);
    } else {
      dispatch({ type: "RESET" });
      clearAssessmentStorage();
    }
  }, [generateAssessment]);

  const reset = useCallback(() => {
    clearAssessmentStorage();
    pendingResultId.current = undefined;
    dispatch({ type: "RESET" });
  }, []);

  // --- Computed values ---

  const q = ASSESSMENT_QUESTIONS[state.stepIndex] ?? ASSESSMENT_QUESTIONS[0];
  const progressEstimate = state.phase === "answering"
    ? (state.stepIndex + 1) / TOTAL_QUESTIONS
    : 0;

  const isValid =
    state.selectedOptions.length > 0 || state.freeText.trim().length > 0;

  return {
    ...state,
    currentQuestion: q.question,
    currentOptions: q.options,
    currentPlaceholder: q.placeholder,
    currentMultiSelect: q.multiSelect,
    progressEstimate,
    totalQuestions: TOTAL_QUESTIONS,
    isValid,
    start,
    toggleOption,
    setFreeText,
    next,
    back,
    retry,
    reset,
  };
}

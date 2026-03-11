"use client";

import { useReducer, useCallback, useEffect, useRef } from "react";
import type { IntakeStep } from "@/app/api/assessment/types";
import {
  getAssessmentStorage,
  setAssessmentStorage,
  clearAssessmentStorage,
  type QuestionHistoryEntry,
} from "@/lib/assessmentStorage";

// --- Q1 Static Configuration ---

const HEALTH_GOALS_OPTIONS: { value: string; label: string }[] = [
  { value: "energy", label: "Energy / Fatigue" },
  { value: "digestion", label: "Digestion / Gut Health" },
  { value: "sleep", label: "Sleep" },
  { value: "weight", label: "Weight" },
  { value: "brain_fog", label: "Brain Fog / Mental Clarity" },
  { value: "mood", label: "Mood / Anxiety" },
  { value: "hormones", label: "Hormones" },
  { value: "skin", label: "Skin" },
  { value: "allergies", label: "Allergies / Immune" },
  { value: "pain", label: "Pain / Inflammation" },
];

export const GOALS_QUESTION = "What are your primary health goals?";
export const GOALS_PLACEHOLDER =
  "Anything else about your health situation you'd like us to know...";

// --- Types ---

export type WizardPhase =
  | "intro"
  | "goals"
  | "loading_step"
  | "answering"
  | "generating"
  | "result"
  | "error";

type StepStatus = "in_progress" | "optional";

export type WizardState = {
  phase: WizardPhase;
  name: string;
  steps: IntakeStep[];
  questionHistory: QuestionHistoryEntry[];
  currentQuestion: string;
  currentOptions: { value: string; label: string }[];
  currentPlaceholder: string;
  currentStatus: StepStatus;
  selectedOptions: string[];
  freeText: string;
  progressEstimate: number;
  stepIndex: number;
  direction: "forward" | "back";
  error: string | null;
  retryAction: "intake" | "generate" | null;
  result: { id: string; report: string } | null;
  isHydrated: boolean;
};

// --- Actions ---

type WizardAction =
  | { type: "HYDRATE"; state: Partial<WizardState> }
  | { type: "SET_NAME"; name: string }
  | { type: "START" }
  | { type: "TOGGLE_OPTION"; value: string }
  | { type: "SET_FREE_TEXT"; text: string }
  | { type: "SUBMIT_STEP" }
  | { type: "INTAKE_SUCCESS"; data: QuestionHistoryEntry }
  | { type: "INTAKE_COMPLETE" }
  | { type: "INTAKE_ERROR"; error: string }
  | { type: "GENERATE_START" }
  | { type: "GENERATE_SUCCESS"; id: string; report: string }
  | { type: "GENERATE_ERROR"; error: string }
  | { type: "BACK" }
  | { type: "RETRY_INTAKE" }
  | { type: "RESET" };

// --- Reducer ---

const initialState: WizardState = {
  phase: "intro",
  name: "",
  steps: [],
  questionHistory: [],
  currentQuestion: GOALS_QUESTION,
  currentOptions: HEALTH_GOALS_OPTIONS,
  currentPlaceholder: GOALS_PLACEHOLDER,
  currentStatus: "in_progress",
  selectedOptions: [],
  freeText: "",
  progressEstimate: 0,
  stepIndex: 0,
  direction: "forward",
  error: null,
  retryAction: null,
  result: null,
  isHydrated: false,
};

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.state, isHydrated: true };

    case "SET_NAME":
      return { ...state, name: action.name };

    case "START":
      return { ...state, phase: "goals", direction: "forward", stepIndex: 0 };

    case "TOGGLE_OPTION": {
      const selected = state.selectedOptions.includes(action.value)
        ? state.selectedOptions.filter((v) => v !== action.value)
        : [...state.selectedOptions, action.value];
      return { ...state, selectedOptions: selected };
    }

    case "SET_FREE_TEXT":
      return { ...state, freeText: action.text };

    case "SUBMIT_STEP": {
      const newStep: IntakeStep = {
        question: state.currentQuestion,
        selectedOptions: state.selectedOptions,
        freeText: state.freeText,
      };
      return {
        ...state,
        phase: "loading_step",
        steps: [...state.steps, newStep],
        direction: "forward",
      };
    }

    case "INTAKE_SUCCESS":
      return {
        ...state,
        phase: "answering",
        currentQuestion: action.data.question,
        currentOptions: action.data.options,
        currentPlaceholder: action.data.freeTextPlaceholder,
        currentStatus: action.data.status,
        progressEstimate: action.data.progressEstimate,
        selectedOptions: [],
        freeText: "",
        questionHistory: [...state.questionHistory, action.data],
        stepIndex: state.steps.length,
        direction: "forward",
      };

    case "INTAKE_COMPLETE":
      return { ...state, phase: "generating" };

    case "INTAKE_ERROR":
      return {
        ...state,
        phase: "error",
        error: action.error,
        retryAction: "intake",
      };

    case "GENERATE_START":
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
        retryAction: "generate",
      };

    case "BACK": {
      if (state.phase === "goals") {
        return { ...state, phase: "intro", direction: "back" };
      }

      if (state.steps.length === 0) {
        return {
          ...state,
          phase: "goals",
          currentQuestion: GOALS_QUESTION,
          currentOptions: HEALTH_GOALS_OPTIONS,
          currentPlaceholder: GOALS_PLACEHOLDER,
          currentStatus: "in_progress",
          selectedOptions: [],
          freeText: "",
          progressEstimate: 0,
          stepIndex: 0,
          direction: "back",
          questionHistory: [],
        };
      }

      const prevSteps = state.steps.slice(0, -1);
      const prevHistory = state.questionHistory.slice(0, -1);
      const lastStep = state.steps[state.steps.length - 1];

      if (prevHistory.length === 0) {
        return {
          ...state,
          phase: "goals",
          steps: prevSteps,
          questionHistory: prevHistory,
          currentQuestion: GOALS_QUESTION,
          currentOptions: HEALTH_GOALS_OPTIONS,
          currentPlaceholder: GOALS_PLACEHOLDER,
          currentStatus: "in_progress",
          selectedOptions: lastStep.selectedOptions,
          freeText: lastStep.freeText,
          progressEstimate: 0,
          stepIndex: 0,
          direction: "back",
        };
      }

      const prevQ = prevHistory[prevHistory.length - 1];
      return {
        ...state,
        phase: "answering",
        steps: prevSteps,
        questionHistory: prevHistory,
        currentQuestion: prevQ.question,
        currentOptions: prevQ.options,
        currentPlaceholder: prevQ.freeTextPlaceholder,
        currentStatus: prevQ.status,
        progressEstimate: prevQ.progressEstimate,
        selectedOptions: lastStep.selectedOptions,
        freeText: lastStep.freeText,
        stepIndex: prevSteps.length,
        direction: "back",
      };
    }

    case "RETRY_INTAKE":
      return { ...state, phase: "loading_step", direction: "forward" };

    case "RESET":
      return { ...initialState, isHydrated: true };

    default:
      return state;
  }
}

// --- Persistence helper ---

function persist(state: WizardState, pendingResultId?: string) {
  setAssessmentStorage({
    name: state.name,
    steps: state.steps,
    questionHistory: state.questionHistory,
    resultId: pendingResultId,
    result: state.result ?? undefined,
  });
}

// --- Hook ---

export function useAssessmentWizard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pendingResultId = useRef<string | undefined>(undefined);
  const isSubmitting = useRef(false);

  // Stable ref to current state for async callbacks
  const stateRef = useRef(state);
  stateRef.current = state;

  // --- Hydrate from localStorage ---

  useEffect(() => {
    const stored = getAssessmentStorage();
    if (stored) {
      if (stored.result) {
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "result",
            name: stored.name,
            steps: stored.steps,
            questionHistory: stored.questionHistory,
            result: stored.result,
          },
        });
        return;
      }

      if (stored.resultId) {
        pendingResultId.current = stored.resultId;
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "error",
            name: stored.name,
            steps: stored.steps,
            questionHistory: stored.questionHistory,
            error: "Your assessment generation was interrupted. Click retry to continue.",
            retryAction: "generate",
            stepIndex: stored.steps.length,
          },
        });
        return;
      }

      if (stored.steps.length > 0 && stored.questionHistory.length > 0) {
        const lastQ = stored.questionHistory[stored.questionHistory.length - 1];
        const lastStep = stored.steps[stored.steps.length - 1];
        dispatch({
          type: "HYDRATE",
          state: {
            phase: "answering",
            name: stored.name,
            steps: stored.steps.slice(0, -1),
            questionHistory: stored.questionHistory.slice(0, -1),
            currentQuestion: lastQ.question,
            currentOptions: lastQ.options,
            currentPlaceholder: lastQ.freeTextPlaceholder,
            currentStatus: lastQ.status,
            progressEstimate: lastQ.progressEstimate,
            selectedOptions: lastStep.selectedOptions,
            freeText: lastStep.freeText,
            stepIndex: stored.steps.length - 1,
          },
        });
        return;
      }
    }

    dispatch({ type: "HYDRATE", state: {} });
  }, []);

  // --- Async actions (read from stateRef to avoid stale closures) ---

  // Ref to break circular dependency: fetchNextStep calls generateAssessment
  const generateRef = useRef<(steps: IntakeStep[]) => Promise<void>>(undefined);

  const fetchNextStep = useCallback(async (steps: IntakeStep[]) => {
    try {
      const res = await fetch("/api/assessment/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();

      if (data.status === "complete") {
        dispatch({ type: "INTAKE_COMPLETE" });
        generateRef.current?.(steps);
        return;
      }

      const historyEntry: QuestionHistoryEntry = {
        question: data.question,
        options: data.options,
        freeTextPlaceholder: data.freeTextPlaceholder,
        status: data.status,
        progressEstimate: data.progressEstimate,
      };

      dispatch({ type: "INTAKE_SUCCESS", data: historyEntry });

      // Persist using pre-dispatch state + the new entry
      const s = stateRef.current;
      setAssessmentStorage({
        name: s.name,
        steps,
        questionHistory: [...s.questionHistory, historyEntry],
      });
    } catch (err) {
      dispatch({
        type: "INTAKE_ERROR",
        error: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      isSubmitting.current = false;
    }
  }, []);

  const generateAssessment = useCallback(async (steps: IntakeStep[]) => {
    dispatch({ type: "GENERATE_START" });

    try {
      const s = stateRef.current;
      const payload: Record<string, unknown> = { steps };
      if (s.name.trim()) payload.name = s.name.trim();
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

  // Keep ref in sync
  generateRef.current = generateAssessment;

  // --- Synchronous action wrappers ---

  const setName = useCallback((name: string) => {
    dispatch({ type: "SET_NAME", name });
  }, []);

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
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    // Read current state synchronously before dispatch
    const s = stateRef.current;
    const newStep: IntakeStep = {
      question: s.currentQuestion,
      selectedOptions: s.selectedOptions,
      freeText: s.freeText,
    };
    const newSteps = [...s.steps, newStep];

    dispatch({ type: "SUBMIT_STEP" });
    fetchNextStep(newSteps);
  }, [fetchNextStep]);

  const back = useCallback(() => {
    dispatch({ type: "BACK" });
  }, []);

  const skip = useCallback(() => {
    const s = stateRef.current;
    generateRef.current?.(s.steps);
  }, []);

  const retry = useCallback(() => {
    const s = stateRef.current;
    if (s.retryAction === "intake") {
      dispatch({ type: "RETRY_INTAKE" });
      fetchNextStep(s.steps);
    } else if (s.retryAction === "generate") {
      generateRef.current?.(s.steps);
    } else {
      dispatch({ type: "RESET" });
      clearAssessmentStorage();
    }
  }, [fetchNextStep]);

  const reset = useCallback(() => {
    clearAssessmentStorage();
    pendingResultId.current = undefined;
    isSubmitting.current = false;
    dispatch({ type: "RESET" });
  }, []);

  // --- Validation ---

  const isValid =
    state.selectedOptions.length > 0 || state.freeText.trim().length > 0;

  return {
    ...state,
    isValid,
    setName,
    start,
    toggleOption,
    setFreeText,
    next,
    back,
    skip,
    retry,
    reset,
  };
}

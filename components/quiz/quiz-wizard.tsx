"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  getQuizStorage,
  setQuizStorage,
  clearQuizStorage,
} from "@/lib/quizStorage";
import { captureUTMParams } from "@/lib/utmStorage";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { QuestionStep } from "./question-step";
import { NameStep } from "./questions/name-step";
import { QuizLoading } from "./quiz-loading";
import { QuizResult } from "./quiz-result";
import type {
  VariantConfig,
  QuestionConfig,
  QuizAnswers,
  YesNoWithFollowUp,
} from "@/lib/quiz/types";
import { isOtherValue, getOtherText, buildOtherValue } from "@/lib/quiz/otherOption";

// --- State helpers ---

type SubmitStatus = "idle" | "submitting" | "success" | "error";
type Direction = "forward" | "back";

function buildInitialAnswers(config: VariantConfig): QuizAnswers {
  const answers: QuizAnswers = {};
  for (const q of config.questions) {
    switch (q.type) {
      case "slider":
        answers[q.id] = q.default;
        break;
      case "yes_no":
        answers[q.id] = q.conditionalFollowUp
          ? { answer: null, followUp: [] }
          : null;
        break;
      case "multi_select":
        answers[q.id] = [];
        break;
      case "single_select":
        answers[q.id] = null;
        break;
      case "free_text":
        answers[q.id] = "";
        break;
    }
  }
  return answers;
}

function isQuestionValid(q: QuestionConfig, value: unknown): boolean {
  switch (q.type) {
    case "slider":
      return true; // always has default value
    case "yes_no":
      if (q.conditionalFollowUp) {
        return (value as YesNoWithFollowUp)?.answer !== null;
      }
      return value !== null;
    case "multi_select": {
      const arr = value as string[];
      if (q.required !== false && arr.length === 0) return false;
      if (q.allowOther !== false) {
        const otherEntry = arr.find(isOtherValue);
        if (otherEntry && !getOtherText(otherEntry)) return false;
      }
      return true;
    }
    case "single_select":
      if (value === null) return false;
      if (q.allowOther !== false && isOtherValue(value as string)) {
        return getOtherText(value as string).length > 0;
      }
      return true;
    case "free_text":
      return q.required !== false
        ? (value as string).trim().length > 0
        : true;
  }
}

// --- Test data generator (dev only) ---

const dietOptions = [
  "Oatmeal with fruit for breakfast. Sandwich and chips for lunch. Pasta with vegetables for dinner. Coffee throughout the day.",
  "Skip breakfast, just coffee. Big lunch usually fast food or leftovers. Dinner is whatever's easy - often takeout or frozen meals.",
  "Eggs and toast in the morning. Salad for lunch. Protein with rice and veggies for dinner. Snack on nuts and fruit.",
  "Smoothie for breakfast. Soup or sandwich for lunch. Home-cooked dinner with meat and vegetables. Lots of water, some wine at night.",
  "Cereal or nothing for breakfast. Work through lunch, maybe a protein bar. Large dinner, often late. Snacks throughout the evening.",
];

const goalOptions = [
  "More consistent energy throughout the day, better sleep quality, improved digestion and mental clarity.",
  "Lose weight and feel less bloated. Want to have energy to exercise again.",
  "Sleep through the night without waking up. Feel sharper at work. Less brain fog.",
  "Improve gut health and reduce digestive issues. More mental clarity and focus.",
  "Feel like myself again. Used to have so much energy, now I'm always tired. Want to figure out what's wrong.",
  "Better overall health. Preparing for pregnancy and want to optimize my body first.",
];

const otherTextByQuestion: Record<string, string[]> = {
  // Digestive
  digestiveDistress: ["Bile reflux after gallbladder removal", "Chronic nausea only in the morning", "Burning sensation after eating"],
  digestiveIssues: ["Undigested food in stool", "Gurgling and cramping at night", "Bile reflux since gallbladder removal"],
  digestiveHealth: ["Excessive mucus in stool", "Feeling of food sitting in stomach for hours"],
  stoolQuality: ["Mucus in stool", "Pencil-thin stools", "Pale or clay-colored"],
  bowelIssues: ["Urgency that wakes me up", "Mucus with bowel movements"],
  symptomTiming: ["Symptoms worst at night before bed", "Only on an empty stomach"],
  // Sleep
  sleepProblem: ["Sleep apnea, wake gasping", "Restless legs keep me awake", "Teeth grinding disrupts sleep"],
  wakeTimingNight: ["Different every night, no pattern", "Only on nights I eat late"],
  wakeReasons: ["Pain wakes me up", "Teeth grinding or jaw clenching", "Shortness of breath"],
  sleepQuality: ["I don't get enough hours due to work schedule", "Sleep apnea even with CPAP", "Chronic pain prevents deep sleep"],
  // Energy
  energyPattern: ["Only have energy late at night", "Energy crashes randomly without pattern", "Fine until I try to exercise"],
  // Weight/Body
  weightStruggle: ["Gaining muscle is impossible despite training", "Weight fluctuates 5-10 lbs weekly"],
  weightDistribution: ["Lower back and love handles", "Upper arms and face", "Legs but not upper body"],
  weightPattern: ["Losing weight unintentionally", "Weight fluctuates dramatically week to week"],
  bodyFatPattern: ["Love handles and lower back", "Face and neck puffiness", "Inner thighs"],
  appetite: ["Appetite is fine but I feel sick after eating", "Hungry all night but not during the day"],
  dietHistory: ["Carnivore diet", "Paleo", "AIP elimination diet"],
  // Mood/Cognitive
  moodSymptoms: ["Depersonalization or feeling detached", "Emotional numbness", "Rage episodes that come out of nowhere"],
  anxietyPattern: ["Worse when I haven't eaten in a while", "Triggered by specific foods", "Only at night when trying to sleep"],
  cognitiveSymptoms: ["Feeling like I'm in a dream", "Can't form new memories well", "Losing words mid-sentence constantly"],
  cognitivePattern: ["Worse after specific meals", "Only clear-headed first thing in the morning"],
  physicalSymptoms: ["Chest tightness", "Dizziness or lightheadedness", "Tingling in hands and feet"],
  // Hormonal
  primaryConcern: ["PCOS symptoms", "Perimenopause symptoms", "Post-birth control syndrome"],
  primaryConcerns: ["Erectile dysfunction", "Night sweats", "Rapid aging"],
  birthControlHistory: ["Switched between multiple types over years"],
  cycleRegularity: ["Cycle is regular but extremely heavy", "Spotting between periods"],
  pmsSymptoms: ["Severe fatigue the week before", "Joint pain before period"],
  hormonalPattern: ["Skin clears during period, worst mid-cycle"],
  // Thyroid
  thyroidSymptoms: ["Hoarse voice", "Difficulty swallowing", "Puffy face especially in the morning"],
  thyroidHistory: ["Hashimoto's diagnosed but undertreated", "Had partial thyroidectomy"],
  coldSensitivity: ["Only cold on one side of my body", "Cold intolerance got worse after pregnancy"],
  hairSkinNails: ["Hair texture completely changed", "Nails have horizontal ridges"],
  dietType: ["Raw vegan", "Carnivore", "Autoimmune protocol (AIP)"],
  // Skin
  skinConditions: ["Folliculitis", "Keratosis pilaris", "Perioral dermatitis"],
  skinOnset: ["After moving to a new home (possible mold)", "After a major surgery", "After COVID"],
  skinLocation: ["Around the eyes", "Only on one side of face", "Behind ears and neck"],
  topicalHistory: ["Steroid withdrawal", "Phototherapy", "Chinese herbal medicine"],
  // Allergies
  allergyTypes: ["Chemical sensitivities (fragrances, cleaning products)", "Exercise-induced reactions", "Cold-induced hives"],
  allergyProgression: ["Went away for years then came back worse", "Started after a course of antibiotics"],
  allergyTiming: ["Worse indoors than outdoors", "Worse at work specifically"],
  medicationUse: ["Cromolyn sodium", "Mast cell stabilizers", "Low-histamine diet"],
  medicationHistory: ["Currently tapering off SSRIs", "Tried multiple medications, none worked"],
  // Combined
  stressAndSleep: ["Moderate stress but terrible sleep from chronic pain", "Low stress but wake every 2 hours to urinate"],
};

const fallbackOtherText = [
  "Started after a major illness",
  "Runs in my family but worse for me",
  "Gets significantly worse with stress",
  "Symptoms change seasonally",
  "Tried many approaches, nothing has stuck",
];

function generateTestData(config: VariantConfig): {
  name: string;
  answers: QuizAnswers;
} {
  const randomBool = () => Math.random() > 0.5;
  const randomFrom = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

  const answers: QuizAnswers = {};
  for (const q of config.questions) {
    switch (q.type) {
      case "slider":
        answers[q.id] =
          Math.floor(Math.random() * (q.max - q.min + 1)) + q.min;
        break;
      case "yes_no": {
        const answer = randomBool();
        if (q.conditionalFollowUp) {
          answers[q.id] = {
            answer,
            followUp: answer
              ? q.conditionalFollowUp.options
                  .filter(() => Math.random() > 0.5)
                  .map((o) => o.value)
              : [],
          };
        } else {
          answers[q.id] = answer;
        }
        break;
      }
      case "multi_select": {
        const selected = q.options
          .filter(() => Math.random() > 0.5)
          .map((o) => o.value);
        // Guarantee at least one selection for required multi_selects
        if (selected.length === 0 && q.required !== false) {
          selected.push(randomFrom(q.options).value);
        }
        if (q.allowOther !== false && Math.random() > 0.7) {
          selected.push(buildOtherValue(randomFrom(otherTextByQuestion[q.id] ?? fallbackOtherText)));
        }
        answers[q.id] = selected;
        break;
      }
      case "single_select":
        if (q.allowOther !== false && Math.random() > 0.7) {
          answers[q.id] = buildOtherValue(randomFrom(otherTextByQuestion[q.id] ?? fallbackOtherText));
        } else {
          answers[q.id] =
            q.options[Math.floor(Math.random() * q.options.length)].value;
        }
        break;
      case "free_text":
        // Use realistic test data for known question types
        if (q.id === "typicalEating") {
          answers[q.id] = randomFrom(dietOptions);
        } else if (q.id === "healthGoals") {
          answers[q.id] = randomFrom(goalOptions);
        } else {
          answers[q.id] = `[Test response for: ${q.question}]`;
        }
        break;
    }
  }

  return { name: "Test User", answers };
}

// --- Main component ---

export function QuizWizard({ config }: { config: VariantConfig }) {
  const totalSteps = config.questions.length + 1; // +1 for name step

  // Form state
  const [answers, setAnswers] = useState<QuizAnswers>(() =>
    buildInitialAnswers(config)
  );
  const [name, setName] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    id: string;
    report: string;
  } | null>(null);
  const [pendingSubmissionId, setPendingSubmissionId] = useState<string | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);

  // Wizard state
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>("forward");

  // Accessibility
  const shouldReduceMotion = useReducedMotion();

  // Restore state from localStorage on mount
  useEffect(() => {
    captureUTMParams();

    const stored = getQuizStorage(config.slug);
    if (stored) {
      setStarted(true);
      if (stored.report) {
        setResult({ id: stored.id, report: stored.report });
        setStatus("success");
      } else {
        setPendingSubmissionId(stored.id);
        setStep(totalSteps - 1);
        setStatus("error");
        setError(
          "Your previous submission encountered an error. You can retry below."
        );
      }
    }
    setIsHydrated(true);
  }, [config.slug, totalSteps]);

  // Navigation
  function goNext() {
    if (step < totalSteps - 1) {
      setDirection("forward");
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (step > 0) {
      setDirection("back");
      setStep((s) => s - 1);
    } else {
      setStarted(false);
    }
  }

  // Validation
  const isNameStep = step === config.questions.length;
  const isLastStep = step === totalSteps - 1;
  const isCurrentStepValid = isNameStep
    ? name.trim().length > 0
    : isQuestionValid(config.questions[step], answers[config.questions[step].id]);
  const progressPercent = ((step + 1) / totalSteps) * 100;

  // Submit handler
  const handleSubmit = useCallback(async () => {
    setStatus("submitting");
    setError(null);

    // Build payload — if retrying, just send submissionId
    const payload = pendingSubmissionId
      ? { submissionId: pendingSubmissionId }
      : {
          variant: config.slug,
          name,
          answers,
        };

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 404) {
          clearQuizStorage(config.slug);
          setPendingSubmissionId(null);
          setStep(0);
          throw new Error("Please submit the quiz again.");
        }

        if (data.submissionId) {
          setPendingSubmissionId(data.submissionId);
          setQuizStorage(config.slug, {
            id: data.submissionId,
            report: null,
          });
        }
        throw new Error(data.error || "Failed to submit quiz");
      }

      setQuizStorage(config.slug, { id: data.id, report: data.report });
      setPendingSubmissionId(null);
      setResult(data);
      setStatus("success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setStatus("error");
    }
  }, [pendingSubmissionId, config.slug, name, answers]);

  // Update a single answer
  function updateAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  // Fill test data (dev only)
  function fillTestData() {
    const testData = generateTestData(config);
    setName(testData.name);
    setAnswers(testData.answers);
    setStep(totalSteps - 1);
  }

  // --- Render ---

  // Hydration guard
  if (!isHydrated) {
    return <div className="min-h-screen quiz-background" />;
  }

  // Intro screen
  if (!started) {
    return (
      <div className="min-h-screen quiz-background flex flex-col items-center justify-center px-4 relative">
        <div className="max-w-md w-full text-center space-y-6">
          <h1 className="text-3xl font-bold tracking-tight">
            {config.headline}
          </h1>
          {config.subtitle && (
            <p className="text-lg text-muted-foreground">{config.subtitle}</p>
          )}
          <Button
            onClick={() => setStarted(true)}
            size="lg"
            className={cn(
              "h-14 px-8 text-base font-semibold rounded-xl shadow-lg",
              "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)]",
              "text-[var(--quiz-text-on-gold)]"
            )}
          >
            Start Assessment
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <ModeToggle />
        </div>
      </div>
    );
  }

  // Result view
  if (result) {
    return <QuizResult result={result} variant={config} />;
  }

  // Loading view
  if (status === "submitting") {
    return <QuizLoading />;
  }

  // Wizard view
  return (
    <div className="min-h-screen quiz-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          {/* Progress bar */}
          <div
            className="h-2 w-full bg-muted rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Step ${step + 1} of ${totalSteps}`}
          >
            <motion.div
              className="h-full bg-[var(--quiz-gold)] rounded-full shadow-[0_0_8px_var(--quiz-gold)]/50"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { type: "tween", duration: 0.3, ease: "easeOut" }
              }
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {step + 1} of {totalSteps}
            </span>
            <div className="flex items-center gap-2">
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fillTestData}
                  className="text-xs"
                >
                  Fill Test
                </Button>
              )}
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{
              opacity: 0,
              x: direction === "forward" ? 80 : -80,
              scale: 0.95,
            }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              x: direction === "forward" ? -80 : 80,
              scale: 0.95,
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : {
                    type: "tween",
                    duration: 0.25,
                    ease: "easeOut",
                  }
            }
            className="w-full max-w-md"
          >
            {isNameStep ? (
              <NameStep
                config={config.nameField}
                value={name}
                onChange={setName}
              />
            ) : (
              <QuestionStep
                config={config.questions[step]}
                value={answers[config.questions[step].id]}
                onChange={(v) =>
                  updateAnswer(config.questions[step].id, v)
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer navigation */}
      <footer className="sticky bottom-0 bg-background border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {error && (
            <div className="mb-3 p-3 bg-destructive/10 text-destructive rounded-xl text-sm text-center" role="alert">
              <p>{error}</p>
              {pendingSubmissionId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Your answers are saved. Click retry to generate your
                  assessment.
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3">
            {!pendingSubmissionId && (
              <Button
                variant="outline"
                onClick={goBack}
                className="h-14 px-6 rounded-xl border-2"
              >
                Back
              </Button>
            )}
            <Button
              onClick={isLastStep ? handleSubmit : goNext}
              disabled={!isCurrentStepValid}
              className={cn(
                "flex-1 h-14 text-base font-semibold rounded-xl shadow-lg transition-all duration-200",
                "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)]",
                "text-[var(--quiz-text-on-gold)]",
                "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
              )}
            >
              {pendingSubmissionId ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Retry
                </>
              ) : isLastStep ? (
                "Get Your Assessment"
              ) : (
                "Next"
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

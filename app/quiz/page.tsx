"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, FileDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Response } from "@/components/ai-elements/response";
import { Loader } from "@/components/ai-elements/loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  type QuizSubmission,
  type WakeReason,
  type BowelIssueType,
  wakeReasons,
  bowelIssueTypes,
} from "@/lib/schemas/quiz";

// ============================================================================
// Types
// ============================================================================

type FormState = {
  email: string;
  name: string;
  phone: string;
  energyLevel: number;
  crashAfterLunch: boolean | null;
  difficultyWaking: boolean | null;
  wakeAtNight: {
    wakes: boolean | null;
    reasons: WakeReason[];
  };
  brainFog: boolean | null;
  bowelIssues: BowelIssueType[];
  coldExtremities: boolean | null;
  whiteTongue: boolean | null;
  typicalEating: string;
  healthGoals: string;
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";
type Direction = "forward" | "back";

// ============================================================================
// Constants
// ============================================================================

const TOTAL_STEPS = 11;

const initialFormState: FormState = {
  email: "",
  name: "",
  phone: "",
  energyLevel: 5,
  crashAfterLunch: null,
  difficultyWaking: null,
  wakeAtNight: { wakes: null, reasons: [] },
  brainFog: null,
  bowelIssues: [],
  coldExtremities: null,
  whiteTongue: null,
  typicalEating: "",
  healthGoals: "",
};

const wakeReasonLabels: Record<WakeReason, string> = {
  no_reason: "No apparent reason",
  eat: "To eat",
  drink: "To drink",
  pee: "To urinate",
};

const bowelIssueLabels: Record<BowelIssueType, string> = {
  straining: "Straining",
  pain: "Pain",
  incomplete: "Incomplete emptying",
  diarrhea: "Diarrhea",
  smell: "Excessive smell/mess",
};

// ============================================================================
// Test Data Generator (dev only)
// ============================================================================

function generateTestData(): FormState {
  const randomBool = () => Math.random() > 0.5;
  const randomFrom = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];
  const randomSubset = <T,>(arr: readonly T[]): T[] =>
    arr.filter(() => Math.random() > 0.5);

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

  const wakes = randomBool();

  return {
    email: "test@example.com",
    name: randomBool() ? "Test User" : "",
    phone: randomBool() ? "555-123-4567" : "",
    energyLevel: Math.floor(Math.random() * 10) + 1,
    crashAfterLunch: randomBool(),
    difficultyWaking: randomBool(),
    wakeAtNight: {
      wakes,
      reasons: wakes ? randomSubset(wakeReasons) : [],
    },
    brainFog: randomBool(),
    bowelIssues: randomSubset(bowelIssueTypes),
    coldExtremities: randomBool(),
    whiteTongue: randomBool(),
    typicalEating: randomFrom(dietOptions),
    healthGoals: randomFrom(goalOptions),
  };
}

// ============================================================================
// Sub-components
// ============================================================================

// Accent color for the quiz (Prism brand: orange/red)
const ACCENT = {
  base: "bg-orange-500 hover:bg-orange-600 border-orange-500",
  light: "bg-orange-400 hover:bg-orange-500 border-orange-400",
  text: "text-white",
  ring: "ring-orange-500/20",
};

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  const baseStyles = cn(
    "px-12 h-14 text-base font-medium !rounded-full border-2",
    "transition-all duration-300 ease-out",
    "hover:scale-105 active:scale-95"
  );
  const unselectedStyles = cn(
    "border-border bg-background shadow-sm",
    "hover:shadow-md hover:border-orange-300 hover:bg-orange-50/50",
    "dark:hover:bg-orange-950/30 dark:hover:border-orange-700"
  );
  const selectedStyles = cn(
    ACCENT.base, ACCENT.text,
    "shadow-lg shadow-orange-500/25",
    "hover:shadow-xl hover:shadow-orange-500/30"
  );

  return (
    <div className="flex justify-center">
      <ToggleGroup
        type="single"
        value={value === null ? undefined : value ? "yes" : "no"}
        onValueChange={(v) => v && onChange(v === "yes")}
        className="gap-4"
      >
        <ToggleGroupItem
          value="yes"
          className={cn(
            baseStyles,
            value === true ? selectedStyles : unselectedStyles
          )}
        >
          Yes
        </ToggleGroupItem>
        <ToggleGroupItem
          value="no"
          className={cn(
            baseStyles,
            value === false ? selectedStyles : unselectedStyles
          )}
        >
          No
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

function MultiSelect<T extends string>({
  options,
  selected,
  onChange,
  labels,
}: {
  options: readonly T[];
  selected: T[];
  onChange: (selected: T[]) => void;
  labels: Record<T, string>;
}): React.ReactElement {
  const toggle = (option: T) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const baseStyles = cn(
    "px-6 py-3 !rounded-full text-sm font-medium border-2 min-h-[48px]",
    "transition-all duration-300 ease-out",
    "hover:scale-105 active:scale-95"
  );
  const unselectedStyles = cn(
    "border-border bg-background shadow-sm",
    "hover:shadow-md hover:border-orange-300 hover:bg-orange-50/50",
    "dark:hover:bg-orange-950/30 dark:hover:border-orange-700"
  );
  const selectedStyles = cn(
    ACCENT.base, ACCENT.text,
    "shadow-lg shadow-orange-500/25",
    "hover:shadow-xl hover:shadow-orange-500/30"
  );

  return (
    <div className="flex flex-wrap justify-center gap-3">
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={cn(
              baseStyles,
              isSelected ? selectedStyles : unselectedStyles
            )}
          >
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function QuizPage(): React.ReactElement {
  // Form state
  const [form, setForm] = useState<FormState>(initialFormState);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; report: string } | null>(null);

  // Wizard state
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<Direction>("forward");

  // Download state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Form update helper
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Navigation
  function goNext(): void {
    if (step < TOTAL_STEPS - 1) {
      setDirection("forward");
      setStep((s) => s + 1);
    }
  }

  function goBack(): void {
    if (step > 0) {
      setDirection("back");
      setStep((s) => s - 1);
    }
  }

  function resetQuiz(): void {
    setForm(initialFormState);
    setResult(null);
    setStep(0);
    setStatus("idle");
    setError(null);
  }

  // Download handler
  const downloadPdf = useCallback(async () => {
    if (!result) return;

    setIsDownloadingPdf(true);
    try {
      const response = await fetch("/api/quiz/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: result.id }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `PDF generation failed: ${response.statusText}`);
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `prism-assessment-${result.id.slice(0, 8)}.pdf`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Quiz PDF] Download error:", err);
      alert(`Failed to download PDF: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [result]);

  // Per-step validation
  function isStepValid(stepIndex: number): boolean {
    switch (stepIndex) {
      case 0: return true; // Energy slider always has value
      case 1: return form.crashAfterLunch !== null;
      case 2: return form.difficultyWaking !== null;
      case 3: return form.wakeAtNight.wakes !== null;
      case 4: return form.brainFog !== null;
      case 5: return true; // Bowel issues can be empty
      case 6: return form.coldExtremities !== null;
      case 7: return form.whiteTongue !== null;
      case 8: return form.typicalEating.trim().length > 0;
      case 9: return form.healthGoals.trim().length > 0;
      case 10: return form.email.includes("@") && form.email.includes(".");
      default: return false;
    }
  }

  const isCurrentStepValid = isStepValid(step);
  const isLastStep = step === TOTAL_STEPS - 1;
  const progressPercent = ((step + 1) / TOTAL_STEPS) * 100;

  // Submit handler
  async function handleSubmit(): Promise<void> {
    setStatus("submitting");
    setError(null);

    const submission: QuizSubmission = {
      email: form.email,
      name: form.name || undefined,
      phone: form.phone || undefined,
      energyLevel: form.energyLevel,
      crashAfterLunch: form.crashAfterLunch!,
      difficultyWaking: form.difficultyWaking!,
      wakeAtNight: {
        wakes: form.wakeAtNight.wakes!,
        reasons:
          form.wakeAtNight.wakes && form.wakeAtNight.reasons.length > 0
            ? form.wakeAtNight.reasons
            : undefined,
      },
      brainFog: form.brainFog!,
      bowelIssues: form.bowelIssues,
      coldExtremities: form.coldExtremities!,
      whiteTongue: form.whiteTongue!,
      typicalEating: form.typicalEating,
      healthGoals: form.healthGoals,
    };

    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit quiz");
      }

      const data = await res.json();
      setResult(data);
      setStatus("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      setStatus("error");
    }
  }

  // Step content renderer
  function renderStepContent(): React.ReactElement {
    const questionClass = "text-xl sm:text-2xl font-semibold text-center leading-relaxed";
    const hintClass = "text-muted-foreground text-center text-sm";

    switch (step) {
      case 0:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Rate your average energy levels throughout the day
            </h2>
            <p className={hintClass}>
              1 = barely able to function, 10 = perfect energy all day
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-16">Exhausted</span>
                <Slider
                  value={[form.energyLevel]}
                  onValueChange={([v]) => updateForm("energyLevel", v)}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-16 text-right">Energized</span>
              </div>
              <div className="text-center text-5xl font-bold tabular-nums">
                {form.energyLevel}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you tend to crash in energy after lunch?
            </h2>
            <YesNoToggle
              value={form.crashAfterLunch}
              onChange={(v) => updateForm("crashAfterLunch", v)}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you have difficulty getting up in the morning?
            </h2>
            <YesNoToggle
              value={form.difficultyWaking}
              onChange={(v) => updateForm("difficultyWaking", v)}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you wake up in the middle of the night?
            </h2>
            <YesNoToggle
              value={form.wakeAtNight.wakes}
              onChange={(v) =>
                updateForm("wakeAtNight", {
                  wakes: v,
                  reasons: v ? form.wakeAtNight.reasons : [],
                })
              }
            />
            {form.wakeAtNight.wakes && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <p className={hintClass}>If so, why? (select all that apply)</p>
                <MultiSelect
                  options={wakeReasons}
                  selected={form.wakeAtNight.reasons}
                  onChange={(reasons) =>
                    updateForm("wakeAtNight", { ...form.wakeAtNight, reasons })
                  }
                  labels={wakeReasonLabels}
                />
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you experience brain fog, or impaired motivation, cognitive function, or memory?
            </h2>
            <YesNoToggle
              value={form.brainFog}
              onChange={(v) => updateForm("brainFog", v)}
            />
          </div>
        );

      case 5:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you experience any of the following with your bowel movements?
            </h2>
            <p className={hintClass}>Select all that apply, or skip if none</p>
            <MultiSelect
              options={bowelIssueTypes}
              selected={form.bowelIssues}
              onChange={(issues) => updateForm("bowelIssues", issues)}
              labels={bowelIssueLabels}
            />
          </div>
        );

      case 6:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you frequently get cold, especially at the fingers, toes, nose, or ears?
            </h2>
            <YesNoToggle
              value={form.coldExtremities}
              onChange={(v) => updateForm("coldExtremities", v)}
            />
          </div>
        );

      case 7:
        return (
          <div className="space-y-8">
            <h2 className={questionClass}>
              Do you notice a white coating on your tongue, especially in the morning?
            </h2>
            <YesNoToggle
              value={form.whiteTongue}
              onChange={(v) => updateForm("whiteTongue", v)}
            />
          </div>
        );

      case 8:
        return (
          <div className="space-y-6">
            <h2 className={questionClass}>
              Describe a typical day of eating for you
            </h2>
            <p className={hintClass}>
              Include breakfast, lunch, dinner, snacks, and drinks
            </p>
            <Textarea
              value={form.typicalEating}
              onChange={(e) => updateForm("typicalEating", e.target.value)}
              placeholder="Example: Coffee and toast for breakfast, salad for lunch, pasta for dinner..."
              rows={5}
              className="text-base"
            />
          </div>
        );

      case 9:
        return (
          <div className="space-y-6">
            <h2 className={questionClass}>
              What health goals are you looking to achieve?
            </h2>
            <p className={hintClass}>
              What would feeling your best look like for you?
            </p>
            <Textarea
              value={form.healthGoals}
              onChange={(e) => updateForm("healthGoals", e.target.value)}
              placeholder="Example: More energy, better sleep, improved focus..."
              rows={4}
              className="text-base"
            />
          </div>
        );

      case 10:
        return (
          <div className="space-y-6">
            <h2 className={questionClass}>
              Where should we send your results?
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  placeholder="you@example.com"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Name <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Your name"
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Phone <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  placeholder="Your phone"
                  className="h-12 text-base"
                />
              </div>
            </div>
          </div>
        );

      default:
        return <div />;
    }
  }

  // Result view
  if (result) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
          <div className="max-w-2xl mx-auto px-4 py-3 flex justify-end">
            <ModeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 py-8">
          <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Success banner with download button */}
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-sm font-medium text-green-600">
                    Assessment generated successfully
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadPdf}
                  disabled={isDownloadingPdf}
                  className="gap-2"
                >
                  {isDownloadingPdf ? (
                    <>
                      <Loader className="h-4 w-4" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Content area */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Your Health Assessment</h2>
              <Response variant="report">{result.report}</Response>
            </div>

            {/* Take quiz again button */}
            <div className="text-center">
              <Button variant="outline" onClick={resetQuiz}>
                Take Quiz Again
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Loading view
  if (status === "submitting") {
    const ringSize = 120;
    const strokeWidth = 4;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          {/* Progress ring with pulsing dots */}
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            {/* Background ring */}
            <svg
              className="absolute inset-0 -rotate-90"
              width={ringSize}
              height={ringSize}
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted"
              />
            </svg>

            {/* Animated progress ring */}
            <svg
              className="absolute inset-0 -rotate-90"
              width={ringSize}
              height={ringSize}
            >
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>
              <motion.circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * 0.1 }}
                transition={{ duration: 12, ease: "easeInOut" }}
              />
            </svg>

            {/* Pulsing dots in center */}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-orange-500 to-red-500"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 text-center"
          >
            <p className="text-lg font-medium text-foreground">
              Analyzing your responses
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Just a moment...
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Wizard view
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          {/* Custom colored progress bar */}
          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">
              {step + 1} of {TOTAL_STEPS}
            </span>
            <div className="flex items-center gap-2">
              {process.env.NODE_ENV === "development" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setForm(generateTestData());
                    setStep(TOTAL_STEPS - 1);
                  }}
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
              scale: 0.95
            }}
            animate={{
              opacity: 1,
              x: 0,
              scale: 1
            }}
            exit={{
              opacity: 0,
              x: direction === "forward" ? -80 : 80,
              scale: 0.95
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30,
              opacity: { duration: 0.2 }
            }}
            className="w-full max-w-md"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer navigation */}
      <footer className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto">
          {error && (
            <div className="mb-3 p-3 bg-destructive/10 text-destructive rounded-xl text-sm text-center">
              {error}
            </div>
          )}
          <div className="flex gap-3">
            {step > 0 && (
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
                "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600",
                "disabled:from-muted disabled:to-muted disabled:text-muted-foreground disabled:shadow-none"
              )}
            >
              {isLastStep ? "Get Your Assessment" : "Next"}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}

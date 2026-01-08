"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  type QuizSubmission,
  wakeReasons,
  bowelIssueTypes,
  type WakeReason,
  type BowelIssueType,
} from "@/lib/schemas/quiz";
import ReactMarkdown from "react-markdown";

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

function YesNoToggle({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === true
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted/80"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          value === false
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted/80"
        }`}
      >
        No
      </button>
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
}) {
  const toggle = (option: T) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            selected.includes(option)
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

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

export default function QuizPage() {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; report: string } | null>(
    null
  );

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = (): boolean => {
    if (!form.email) return false;
    if (form.crashAfterLunch === null) return false;
    if (form.difficultyWaking === null) return false;
    if (form.wakeAtNight.wakes === null) return false;
    if (form.brainFog === null) return false;
    if (form.coldExtremities === null) return false;
    if (form.whiteTongue === null) return false;
    if (!form.typicalEating.trim()) return false;
    if (!form.healthGoals.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid()) {
      setError("Please answer all required questions");
      return;
    }

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
      setError(err instanceof Error ? err.message : "An error occurred");
      setStatus("error");
    }
  };

  // Show result if we have one
  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{result.report}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-4">Health Assessment Quiz</h1>
          <p className="text-muted-foreground">
            Ready to take the quiz? This short assessment will give us key
            insights into your health, and what you might need to work on to
            feel your best.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Question 1: Energy Level */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              1. Rate your average energy levels throughout the day
              <span className="text-muted-foreground ml-1">
                (1 = barely walk fatigued, 10 = perfect energy)
              </span>
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={10}
                value={form.energyLevel}
                onChange={(e) =>
                  updateForm("energyLevel", parseInt(e.target.value))
                }
                className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-2xl font-bold w-8 text-center">
                {form.energyLevel}
              </span>
            </div>
          </div>

          {/* Question 2: Crash after lunch */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              2. Do you tend to have a crash in energy after lunch?
            </label>
            <YesNoToggle
              value={form.crashAfterLunch}
              onChange={(v) => updateForm("crashAfterLunch", v)}
            />
          </div>

          {/* Question 3: Difficulty waking */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              3. Do you have difficulty getting up in the morning?
            </label>
            <YesNoToggle
              value={form.difficultyWaking}
              onChange={(v) => updateForm("difficultyWaking", v)}
            />
          </div>

          {/* Question 4: Wake at night */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              4. Do you wake up in the middle of the night?
            </label>
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
              <div className="ml-4 mt-3 space-y-2">
                <label className="block text-sm text-muted-foreground">
                  If so, why?
                </label>
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

          {/* Question 5: Brain fog */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              5. Do you experience brain fog, or a feeling of impaired
              motivation, cognitive function and memory?
            </label>
            <YesNoToggle
              value={form.brainFog}
              onChange={(v) => updateForm("brainFog", v)}
            />
          </div>

          {/* Question 6: Bowel issues */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              6. Do you experience any of the following with your bowel
              movements?
            </label>
            <MultiSelect
              options={bowelIssueTypes}
              selected={form.bowelIssues}
              onChange={(issues) => updateForm("bowelIssues", issues)}
              labels={bowelIssueLabels}
            />
            <p className="text-xs text-muted-foreground">
              Select all that apply, or leave empty if none
            </p>
          </div>

          {/* Question 7: Cold extremities */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              7. Do you frequently get cold, especially at the fingers, toes,
              nose and ears?
            </label>
            <YesNoToggle
              value={form.coldExtremities}
              onChange={(v) => updateForm("coldExtremities", v)}
            />
          </div>

          {/* Question 8: White tongue */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              8. Do you notice your tongue has a white coating on it, especially
              in the morning?
            </label>
            <YesNoToggle
              value={form.whiteTongue}
              onChange={(v) => updateForm("whiteTongue", v)}
            />
          </div>

          {/* Question 9: Typical eating */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              9. Write out what a typical day of eating looks like for you
            </label>
            <Textarea
              value={form.typicalEating}
              onChange={(e) => updateForm("typicalEating", e.target.value)}
              placeholder="Breakfast, lunch, dinner, snacks..."
              rows={4}
            />
          </div>

          {/* Question 10: Health goals */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              10. Let us know of any other health goals you&apos;re looking to
              achieve!
            </label>
            <Textarea
              value={form.healthGoals}
              onChange={(e) => updateForm("healthGoals", e.target.value)}
              placeholder="What would feeling your best look like?"
              rows={3}
            />
          </div>

          {/* Contact Info */}
          <div className="border-t pt-8 space-y-4">
            <h3 className="font-medium">Your Information</h3>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Name <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Phone{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  placeholder="Your phone"
                />
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={status === "submitting"}
          >
            {status === "submitting" ? (
              <>
                <Loader2 className="animate-spin" />
                Analyzing your responses...
              </>
            ) : (
              "Get Your Assessment"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

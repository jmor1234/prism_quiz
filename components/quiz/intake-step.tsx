"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { suggestEmailFix } from "@/lib/quiz/emailHints";
import type { VariantConfig } from "@/lib/quiz/types";

// Minimal RFC-ish email regex. Catches obvious garbage ("foo@bar"), permits
// the long tail of valid addresses. Server-side `z.string().email()` is the
// final word.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface IntakeStepProps {
  config: VariantConfig;
  initialName: string;
  initialEmail: string;
  onSubmit: (intake: { name: string; email: string }) => void;
  onBack: () => void;
}

export function IntakeStep({
  config,
  initialName,
  initialEmail,
  onSubmit,
  onBack,
}: IntakeStepProps) {
  const shouldReduceMotion = useReducedMotion();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const isValid =
    trimmedName.length > 0 && EMAIL_REGEX.test(trimmedEmail);

  // Only surface a suggestion once the input looks email-shaped; otherwise
  // every keystroke would flicker hints.
  const suggestion = useMemo(() => {
    if (!EMAIL_REGEX.test(trimmedEmail)) return null;
    return suggestEmailFix(trimmedEmail);
  }, [trimmedEmail]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({ name: trimmedName, email: trimmedEmail });
  }

  return (
    <div className="min-h-screen quiz-background flex flex-col items-center justify-center px-4 relative">
      <motion.form
        onSubmit={handleSubmit}
        initial={shouldReduceMotion ? {} : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
        className="max-w-md w-full space-y-6"
      >
        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Before we start
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;ll use this to follow up with you about your results.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="intake-name"
              className="text-sm font-medium"
            >
              {config.nameField.question}
            </label>
            <Input
              id="intake-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={config.nameField.placeholder}
              autoComplete="name"
              autoFocus
              className="h-12"
            />
            {config.nameField.hint && (
              <p className="text-xs text-muted-foreground">
                {config.nameField.hint}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="intake-email"
              className="text-sm font-medium"
            >
              {config.emailField?.question ?? "What's your email?"}
            </label>
            <Input
              id="intake-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={config.emailField?.placeholder ?? "you@example.com"}
              autoComplete="email"
              inputMode="email"
              className="h-12"
            />
            {suggestion ? (
              <p className="text-xs text-muted-foreground">
                Did you mean{" "}
                <button
                  type="button"
                  onClick={() => setEmail(suggestion)}
                  className="font-medium text-[var(--quiz-gold-dark)] underline underline-offset-2 hover:no-underline"
                >
                  {suggestion}
                </button>
                ?
              </p>
            ) : (
              config.emailField?.hint && (
                <p className="text-xs text-muted-foreground">
                  {config.emailField.hint}
                </p>
              )
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="h-14 px-6 rounded-xl border-2"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={!isValid}
            className={cn(
              "flex-1 h-14 text-base font-semibold rounded-xl shadow-lg transition-all duration-200",
              "bg-[var(--quiz-gold)] hover:bg-[var(--quiz-gold-dark)]",
              "text-[var(--quiz-text-on-gold)]",
              "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            )}
          >
            Continue
          </Button>
        </div>
      </motion.form>

      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
    </div>
  );
}

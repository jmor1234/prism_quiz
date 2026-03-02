# Project Status: Multi-Variant Quiz System

## The Goal

Transform the Prism quiz from a single hardcoded health assessment into a config-driven engine that supports 11 condition-specific quiz variants. Each variant is defined by a single config object -- its own questions, prompt guidance, UI copy, and metadata. The infrastructure (wizard UI, storage, retry, admin, PDF, UTM tracking, LLM generation) is shared. Adding a new variant requires zero code changes.

**The 11 variants:**

| Slug | Name | Status |
|------|------|--------|
| `root-cause` | Root Cause Assessment | Live (migrated from original) |
| `gut` | Gut Health Assessment | Built -- ready to test |
| `fatigue` | Energy & Fatigue Assessment | Built -- ready to test |
| `hormones-women` | Women's Hormonal Assessment | Built -- ready to test |
| `testosterone` | Men's Hormone & Performance Assessment | Built -- ready to test |
| `sleep` | Sleep Assessment | Built -- ready to test |
| `thyroid` | Thyroid & Metabolism Assessment | Built -- ready to test |
| `brain-fog` | Brain Fog & Cognitive Assessment | Built -- ready to test |
| `weight` | Weight & Body Composition Assessment | Built -- ready to test |
| `skin` | Skin Health Assessment | Built -- ready to test |
| `anxiety` | Anxiety & Mood Assessment | Built -- ready to test |

All 11 variants build clean, generate static pages, and are accessible at `/quiz/{slug}`.

---

## Phase 1 -- COMPLETE

Phase 1 was a pure refactor: rebuild the existing root-cause quiz on top of the new config-driven engine, verifying identical behavior.

### Architecture Built

**Core type system** (`lib/quiz/types.ts`)
- `QuestionConfig` -- discriminated union of 5 question types: slider, yes_no, multi_select, single_select, free_text
- `VariantConfig` -- the complete contract for a quiz variant: slug, name, questions, prompt overlay, UI copy, metadata
- `QuizSubmissionRecord`, `QuizEntry` -- new storage record shapes with `variant`, `name`, `answers` at top level

**Dynamic schema validation** (`lib/quiz/schema.ts`)
- `buildSubmissionSchema(variant)` generates a Zod schema from any variant config at runtime
- Validates `{ variant, name, answers: { ... } }` where answer fields match the question types

**Generic answer formatter** (`lib/quiz/formatAnswers.ts`)
- `formatAnswers(variant, name, answers)` produces the markdown text injected into the LLM prompt
- Driven entirely by the variant config -- uses `promptLabel` for concise field names, `option.promptLabel` where UI and prompt labels differ
- Character-identical output to the original hardcoded formatter for root-cause

**Variant config + registry** (`lib/quiz/variants/`)
- `root-cause.ts` -- faithful translation of the original 10-question quiz into VariantConfig format
- `index.ts` -- registry with `getVariant(slug)`, `getAllVariants()`, `getAllVariantSlugs()`

### Frontend Decomposition

The original monolithic `app/quiz/page.tsx` (1007 lines) was decomposed into:

**Question type components** (`components/quiz/questions/`)
- `slider-question.tsx` -- range slider with value display
- `yes-no-question.tsx` -- toggle with optional conditional follow-up multi-select
- `multi-select-question.tsx` -- pill-style multi-select buttons
- `single-select-question.tsx` -- radio-style single select
- `free-text-question.tsx` -- textarea with label/hint
- `name-step.tsx` -- name input (always the last step before submit)

**Wizard engine** (`components/quiz/quiz-wizard.tsx`)
- Config-driven: takes a `VariantConfig`, renders any quiz from it
- Manages generic `Record<string, unknown>` form state built from config
- Step navigation with Framer Motion spring animations + `useReducedMotion` support
- Per-type validation, progress bar, retry flow, dev test data generator
- Total steps = `config.questions.length + 1` (questions + name step)

**Supporting components**
- `question-step.tsx` -- dispatcher that routes to the correct question type component
- `quiz-loading.tsx` -- SVG progress ring with pulsing dots animation
- `quiz-result.tsx` -- result display with markdown rendering, booking CTA, PDF download
- `quiz-client.tsx` -- thin `"use client"` wrapper (the server/client boundary)
- `quiz-theme.ts` -- shared ACCENT colors, question/hint CSS class constants

### Route Structure

```
/quiz                  --> redirect (307) to /quiz/root-cause
/quiz/[variant]        --> server component, resolves variant config, renders QuizClient
/quiz/nonexistent      --> 404
```

`app/quiz/[variant]/page.tsx` is a server component with `generateMetadata` (per-variant SEO) and `generateStaticParams` (pre-renders known variants at build time).

### Backend Changes

**API route** (`app/api/quiz/route.ts`)
- Accepts new payload: `{ variant: "root-cause", name: "...", answers: { ... } }`
- Resolves variant config, validates with dynamic schema, saves, generates, returns
- Retry flow unchanged: `{ submissionId: "uuid" }` fetches stored record (normalized)

**System prompt** (`app/api/quiz/systemPrompt.ts`)
- Uses generic `formatAnswers(variant, name, answers)` instead of hardcoded formatter
- Injects `variant.promptOverlay` between knowledge and answers (empty for root-cause)
- Knowledge loading unchanged (3 cached .md files)

**Storage normalization** (`server/quizSubmissions.ts`)
- New record shape: `{ id, createdAt, variant, name, answers }`
- `normalizeRecord()` on every read converts old format to new:
  - Missing `variant` defaults to `"root-cause"`
  - `submission.name` moves to top-level `name`
  - `wakeAtNight: { wakes, reasons }` maps to `{ answer, followUp }`
- No data migration needed -- old records in Redis/filesystem normalize transparently

**Client storage** (`lib/quizStorage.ts`)
- Variant-scoped keys: `"prism-quiz:{variant}"`
- V1 migration: old `"prism-quiz"` key auto-migrates to `"prism-quiz:root-cause"` on first read

**Admin dashboard** (`app/admin/results/page.tsx`)
- Updated to new record shape: `entry.name`, `entry.answers.*`
- Old submissions display correctly through normalization
- Still root-cause-specific display (hardcoded field rendering)

**Admin PDF** (`app/api/admin/results/pdf/`)
- Template updated for new record shape
- Route passes `name` and `answers` separately

### Verified Working

Tested end-to-end in dev:
- `/quiz` redirect to `/quiz/root-cause`
- All question types render and accept input
- Fill Test button populates random data
- API submission with new payload shape succeeds
- LLM generation completes and result displays
- PDF download works
- Loading animation displays correctly
- Admin dashboard shows both old-format and new-format submissions
- Old submissions normalize and render correctly
- Build passes clean (TypeScript + Next.js)

---

## Phase 2 -- COMPLETE

Phase 2 populated the engine with 10 new condition-specific variant configs. Each variant is a single config file in `lib/quiz/variants/` registered in `index.ts`. No infrastructure changes were needed.

### What Was Built

10 new variant config files, each containing:
- **11 questions** following the question architecture: 1-2 anchor, 4-6 condition-specific, 2-3 cross-system, 1 diet, 1 goals
- **Prompt overlay** -- condition-specific guidance for the LLM (how to interpret answers through the bioenergetic lens for this condition)
- **UI copy** -- headline, subtitle, description, result banner
- **Shared CTA** -- "Book a Free Consultation" → prism.miami/consultation (all variants)

### Question Architecture

Every question satisfies three criteria:
1. **Mechanistic signal** -- the answer maps to a root cause the agent can reason about
2. **Answerable in seconds** -- lead gen, not clinical intake
3. **Interconnection potential** -- reveals connections the person hasn't made themselves

Cross-system questions are the key differentiator. They reveal *why* the primary condition exists:
- Gut quiz asks about energy and cold hands → reveals thyroid suppression driving poor motility
- Testosterone quiz asks about digestion and sleep → reveals gut inflammation suppressing androgens
- Sleep quiz asks about digestion and energy crashes → reveals blood sugar and gut irritation as sleep disruptors

### Per-Variant Summary

| Variant | Questions | Types Used | Key Cross-System Signals |
|---------|-----------|------------|--------------------------|
| `gut` | 11 | multi_select, single_select, yes_no, slider, free_text | energy, brain fog, cold extremities |
| `fatigue` | 11 | slider, single_select, yes_no, multi_select, free_text | cold extremities, digestive issues, brain fog, night waking (with follow-up) |
| `hormones-women` | 11 | multi_select (9 options), single_select, yes_no, slider, free_text | digestive issues, energy, cold extremities |
| `testosterone` | 11 | multi_select, yes_no, single_select, slider, free_text | digestive health, energy, cold extremities |
| `sleep` | 11 | multi_select, single_select, yes_no, slider, free_text | energy crash after eating, digestive issues, cold extremities |
| `thyroid` | 11 | multi_select, single_select (4), yes_no, free_text | digestive issues, stress, dietary approach |
| `brain-fog` | 11 | multi_select, single_select, yes_no, slider, free_text | energy, cold extremities, digestive issues, white tongue |
| `weight` | 11 | single_select (4), multi_select, yes_no, slider, free_text | energy, cold extremities, digestive issues, stress/sleep |
| `skin` | 11 | multi_select (4), single_select, yes_no, slider, free_text | digestive issues, white tongue, energy |
| `anxiety` | 11 | multi_select (2), single_select (2), yes_no, slider, free_text | digestive issues, energy, cold extremities, blood sugar |

### Shared Question IDs Across Variants

| ID | Present In | Purpose |
|----|-----------|---------|
| `energyLevel` | All 10 | Universal metabolic signal (slider 1-10) |
| `coldExtremities` | 8 of 10 (not thyroid, not skin) | Thyroid/metabolic rate indicator |
| `typicalEating` | All 10 | Diet evaluation (free text) |
| `healthGoals` | All 10 | Personalization anchor (free text, variant-specific question) |
| `digestiveIssues` | 7 of 10 (not gut) | Cross-system gut signal (varies: yes_no or multi_select) |

### Design Decisions

1. **"None of these" in multi_selects** -- removed from option lists, replaced with `required: false` + hint "Select all that apply, or skip if none". Prevents contradictory state.
2. **Inline question definitions** -- each config is self-contained. No shared question pool. Same IDs enable cross-variant comparison without coupling.
3. **promptLabel on every question** -- short noun-phrase labels for clean AI prompt output (e.g., "Energy Level", "Crash after eating", "Digestive issues").
4. **ogImage omitted** -- deferred to Phase 3 for per-variant social preview images.

### Verified Working

- TypeScript compiles clean
- Next.js builds 23 static pages (was 13 before Phase 2)
- All 11 variant routes pre-rendered via `generateStaticParams`
- Post-implementation review: zero blocking issues across all configs

---

## What Remains (Phase 3 and Beyond)

### Phase 3: Infrastructure Polish

- [ ] Per-variant Redis indexes (`quiz-index:{variant}`) for filtered admin queries
- [ ] Admin variant filter dropdown
- [ ] Fully config-driven admin display (replace hardcoded `QuizAnswersDisplay` with generic renderer)
- [ ] Fully config-driven admin PDF template
- [ ] Per-variant OG images
- [ ] Analytics: conversion tracking per variant

### Open Design Questions

1. **Variant landing/index page?** A page at `/quiz` showing all available quizzes? Or each quiz always reached via direct ad link?
2. **Name step position?** First (early personalization) or last (less friction)? Could be per-variant.
3. **Email capture?** Optional email field for follow-up sequences. Per-variant toggle.

---

## File Structure

```
lib/quiz/
  types.ts                          # Core type definitions
  schema.ts                         # Dynamic Zod schema builder
  formatAnswers.ts                  # Generic answer formatter for prompts
  variants/
    index.ts                        # Variant registry (11 variants)
    root-cause.ts                   # Root cause config (Phase 1)
    gut.ts                          # Gut health (Phase 2)
    fatigue.ts                      # Energy & fatigue (Phase 2)
    hormones-women.ts               # Women's hormonal (Phase 2)
    testosterone.ts                 # Men's hormone (Phase 2)
    sleep.ts                        # Sleep (Phase 2)
    thyroid.ts                      # Thyroid & metabolism (Phase 2)
    brain-fog.ts                    # Brain fog & cognitive (Phase 2)
    weight.ts                       # Weight & body composition (Phase 2)
    skin.ts                         # Skin health (Phase 2)
    anxiety.ts                      # Anxiety & mood (Phase 2)

components/quiz/
  quiz-wizard.tsx                   # Config-driven wizard engine
  quiz-client.tsx                   # Client boundary wrapper
  quiz-loading.tsx                  # Loading animation
  quiz-result.tsx                   # Result display + CTA + PDF
  quiz-theme.ts                     # Shared styling constants
  question-step.tsx                 # Question type dispatcher
  questions/
    slider-question.tsx
    yes-no-question.tsx
    multi-select-question.tsx
    single-select-question.tsx
    free-text-question.tsx
    name-step.tsx

app/quiz/
  page.tsx                          # Redirect to /quiz/root-cause
  [variant]/page.tsx                # Dynamic route (server component)

app/api/quiz/
  route.ts                          # Variant-aware submission endpoint
  systemPrompt.ts                   # Prompt builder with overlay support

server/
  quizSubmissions.ts                # Storage with backward-compatible normalization
  quizResults.ts                    # Result storage (unchanged)

lib/
  quizStorage.ts                    # Variant-scoped localStorage (v2)
  utmStorage.ts                     # UTM tracking (unchanged)
  knowledge/                        # Shared knowledge files (unchanged)
    knowledge.md
    questionaire.md
    diet_lifestyle_standardized.md
```

---

## Key Design Principle

The system works because of a deliberate asymmetry: **deep shared knowledge, thin variant-specific data, constrained output**.

The three knowledge files (bioenergetic model, symptom interpretation, diet/lifestyle framework) are shared across all variants. They give the agent enough theoretical depth to reason about any health condition. The variant config provides:
- **Questions** that collect the right data points for this condition
- **Prompt overlay** that steers the agent's pattern recognition toward the relevant mechanisms
- **UI copy** that speaks to the prospect's specific concern

The output is always the same shape: personalized patterns + consultation CTA. The variant determines what patterns emerge, not how the system works.

# Project Status: Multi-Variant Quiz System

## The Goal

Transform the Prism quiz from a single hardcoded health assessment into a config-driven engine that supports 11 condition-specific quiz variants. Each variant is defined by a single config object -- its own questions, prompt guidance, UI copy, and metadata. The infrastructure (wizard UI, storage, retry, admin, PDF, UTM tracking, LLM generation) is shared. Adding a new variant requires zero code changes.

**The 11 variants:**

| Slug | Name | Status |
|------|------|--------|
| `root-cause` | Root Cause Assessment | Live (migrated from original) |
| `gut` | Gut Health Assessment | Not started |
| `fatigue` | Energy & Fatigue Assessment | Not started |
| `hormones-women` | Women's Hormonal Assessment | Not started |
| `testosterone` | Men's Hormone & Performance Assessment | Not started |
| `sleep` | Sleep Assessment | Not started |
| `thyroid` | Thyroid & Metabolism Assessment | Not started |
| `brain-fog` | Brain Fog & Cognitive Assessment | Not started |
| `weight` | Weight & Body Composition Assessment | Not started |
| `skin` | Skin Health Assessment | Not started |
| `anxiety` | Anxiety & Mood Assessment | Not started |

---

## What We Have Done (Phase 1) -- COMPLETE

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
- `index.ts` -- registry with `getVariant(slug)`, `getAllVariantSlugs()`

### Frontend Decomposition

The original monolithic `app/quiz/page.tsx` (1007 lines) was decomposed into:

**Question type components** (`components/quiz/questions/`)
- `slider-question.tsx` -- range slider with value display
- `yes-no-question.tsx` -- toggle with optional conditional follow-up multi-select
- `multi-select-question.tsx` -- pill-style multi-select buttons
- `single-select-question.tsx` -- radio-style single select (not used by root-cause, ready for Phase 2)
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
- Still root-cause-specific for Phase 1 (hardcoded field rendering)

**Admin PDF** (`app/api/admin/results/pdf/`)
- Template updated for new record shape
- Route passes `name` and `answers` separately

### Verified Working

Tested end-to-end in dev:
- `/quiz` redirect to `/quiz/root-cause`
- All 10 question types render and accept input
- Fill Test button populates random data
- API submission with new payload shape succeeds
- LLM generation completes and result displays
- PDF download works
- Loading animation displays correctly
- Admin dashboard shows both old-format and new-format submissions
- Old submissions normalize and render correctly
- Build passes clean (TypeScript + Next.js)

---

## What Remains (Phase 2 and Beyond)

### Phase 2: Build the 10 New Variants

For each variant, create one config file in `lib/quiz/variants/` containing:
1. **8-12 questions** following the design principles:
   - 1-2 anchor questions (primary symptom/concern)
   - 4-6 condition-specific questions
   - 2-3 cross-system signals (gut quiz asks about energy, testosterone quiz asks about sleep)
   - 1 diet/lifestyle free text (universal)
   - 1 health goals free text (universal)
2. **Prompt overlay** -- condition-specific guidance telling the agent how to interpret answers through the bioenergetic lens for this condition
3. **UI copy** -- headline, subtitle, result banner, CTA text
4. **Metadata** -- description, OG image path

Register the config in `lib/quiz/variants/index.ts`. It's immediately live at `/quiz/{slug}`.

**The 10 variants to build:**
- [ ] `gut` -- IBS, bloating, SIBO, digestion
- [ ] `fatigue` -- chronic fatigue, low energy
- [ ] `hormones-women` -- estrogen, PCOS, cycle issues
- [ ] `testosterone` -- low T, muscle, vitality
- [ ] `sleep` -- insomnia, waking, non-restorative sleep
- [ ] `thyroid` -- "labs normal but feel terrible"
- [ ] `brain-fog` -- focus, memory, mental clarity
- [ ] `weight` -- can't lose weight despite effort
- [ ] `skin` -- acne, eczema, gut-skin axis
- [ ] `anxiety` -- gut-brain axis, serotonin reframe

### Phase 3: Infrastructure Polish

- [ ] Per-variant Redis indexes (`quiz-index:{variant}`) for filtered admin queries
- [ ] Admin variant filter dropdown
- [ ] Fully config-driven admin display (replace hardcoded `QuizAnswersDisplay` with generic renderer)
- [ ] Fully config-driven admin PDF template
- [ ] Per-variant OG images
- [ ] Analytics: conversion tracking per variant

### Open Design Questions (deferred from Phase 1)

1. **Variant landing/index page?** A page at `/quiz` showing all available quizzes? Or each quiz always reached via direct ad link?
2. **Name step position?** First (early personalization) or last (less friction)? Could be per-variant.
3. **Email capture?** Optional email field for follow-up sequences. Per-variant toggle.
4. **Shared question pool?** Formalize universal questions (energy, diet, goals) as a shared pool variants can import? Or let each variant define independently with overlapping IDs?

---

## File Structure

```
lib/quiz/
  types.ts                          # Core type definitions
  schema.ts                         # Dynamic Zod schema builder
  formatAnswers.ts                  # Generic answer formatter for prompts
  variants/
    index.ts                        # Variant registry
    root-cause.ts                   # Root cause config (Phase 1)
    gut.ts                          # (Phase 2)
    fatigue.ts                      # (Phase 2)
    ...                             # 8 more variant configs

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

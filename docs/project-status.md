# Project Status: Multi-Variant Quiz System

## The Goal

Transform the Prism quiz from a single hardcoded health assessment into a config-driven engine that supports 11 condition-specific quiz variants. Each variant is defined by a single config object -- its own questions, prompt guidance, UI copy, and metadata. The infrastructure (wizard UI, storage, retry, admin, PDF, UTM tracking, LLM generation) is shared. Adding a new variant requires zero code changes.

**The 11 variants:**

| Slug | Name | Status |
|------|------|--------|
| `root-cause` | Root Cause Assessment | Live |
| `gut` | Gut Health Assessment | Live |
| `fatigue` | Energy & Fatigue Assessment | Live |
| `hormones-women` | Women's Hormonal Assessment | Live |
| `testosterone` | Men's Hormone & Performance Assessment | Live |
| `sleep` | Sleep Assessment | Live |
| `thyroid` | Thyroid & Metabolism Assessment | Live |
| `brain-fog` | Brain Fog & Cognitive Assessment | Live |
| `weight` | Weight & Body Composition Assessment | Live |
| `skin` | Skin Health Assessment | Live |
| `anxiety` | Anxiety & Mood Assessment | Live |

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
- Config-driven answer display for all variants (Phase 3)

**Admin PDF** (`app/api/admin/results/pdf/`)
- Config-driven answer rendering for all variants (Phase 3)
- Route passes `variant`, `name`, and `answers` to template

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

## Phase 3 -- COMPLETE

Phase 3 made the admin system fully config-driven and added variant filtering. Legacy hardcoded files were deleted.

### What Was Built

**Config-driven admin answer display** (`app/admin/results/page.tsx`)
- `QuizAnswersDisplay` resolves `VariantConfig` via `getVariant(entry.variant)`
- `AnswerField` component renders each answer based on question type from config
- Option labels resolved from `question.options` and `question.conditionalFollowUp.options` -- no hardcoded label maps
- Fallback for unknown variants: renders raw key-value pairs
- `SliderValue` component uses actual `max` from config (not hardcoded `/10`)

**Variant filtering**
- Storage layer: dual-write to per-variant Redis index (`quiz-index:{variant}`) on save
- `listQuizEntries` and `searchQuizEntriesByName` accept optional `variant` parameter
- Admin API accepts `?variant=slug` query parameter
- Admin dashboard: variant filter dropdown populated from `getAllVariants()`
- All fetch paths (initial, search, refresh, load more) pass the selected variant

**Variant badge on entry rows**
- Each entry row shows the variant name badge next to the person's name

**Config-driven admin PDF** (`app/api/admin/results/pdf/lib/adminPdfTemplate.ts`)
- `buildAnswersSection` iterates variant questions, formats by type
- Table questions (slider, yes_no, multi_select, single_select) in HTML table
- Free-text questions rendered as separate sections below the table
- Variant name shown in PDF header
- Fallback for unknown variants: raw key-value table

**Legacy cleanup**
- Deleted `lib/schemas/quiz.ts` (old Zod schema, replaced by dynamic `buildSubmissionSchema`)
- Deleted `lib/labels/quizLabels.ts` (old label maps, replaced by config lookups)
- Zero remaining references to either file

---

## Post-Phase Work -- COMPLETE

### Quiz Intro Screen

Each variant now has an intro screen before question 1. Displays `headline` and `subtitle` from the variant config with a "Start Assessment" button. Implemented as a `started` boolean state in the wizard -- no changes to step numbering or progress bar. Back from question 1 returns to intro. Returning users with localStorage data skip the intro automatically.

### Landing Page at `/quiz`

`/quiz` is now a landing page (server component) showing all 11 variants as a card grid. Each card shows variant name + subtitle and links to `/quiz/{slug}`. Replaced the old redirect to `/quiz/root-cause`. Route flow: `/` → `/quiz` (landing) → click card → `/quiz/{slug}` (intro → quiz).

### Deep Dive Knowledge Files

Two additional knowledge files injected into the LLM system prompt:
- `metabolism_deep_dive.md` -- biochemical depth on energy metabolism
- `gut_deep_dive.md` -- mechanistic depth on gut health

Injected with explicit framing: "use it to think, not to quote" -- the agent internalizes the mechanisms for reasoning, not retrieval.

### Performance Optimizations

- Knowledge file loading parallelized with `Promise.all` (was 5 sequential reads)
- Retry flow parallelized (`getQuizSubmission` + `getQuizResult` in parallel)
- Server-only fields (`promptOverlay`, `description`, `ogImage`) stripped before passing to client component
- Mobile responsiveness fixes: textarea font-size 16px (prevents iOS zoom), slider thumb enlarged, slider labels repositioned, safe area insets on sticky header
- Web guidelines compliance: `color-scheme` on html, `theme-color` meta, `aria-hidden` on decorative SVGs, specific CSS transitions (no `transition-all`)

### Production Storage

Upstash Redis configured in production via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables on Vercel. Filesystem fallback for local dev. Tested and verified working.

---

## What Remains (Future)

### Possible Enhancements

- [ ] Per-variant OG images (infrastructure supports it -- just needs design assets + `ogImage` field set in each config)
- [ ] Analytics: conversion tracking per variant (external configuration)
- [ ] Email capture with per-variant toggle
- [ ] Name step position configurable per-variant (first vs last)

---

## File Structure

```
lib/quiz/
  types.ts                          # Core type definitions
  schema.ts                         # Dynamic Zod schema builder
  formatAnswers.ts                  # Generic answer formatter for prompts
  variants/
    index.ts                        # Variant registry (11 variants)
    root-cause.ts                   # Root cause config
    gut.ts                          # Gut health
    fatigue.ts                      # Energy & fatigue
    hormones-women.ts               # Women's hormonal
    testosterone.ts                 # Men's hormone
    sleep.ts                        # Sleep
    thyroid.ts                      # Thyroid & metabolism
    brain-fog.ts                    # Brain fog & cognitive
    weight.ts                       # Weight & body composition
    skin.ts                         # Skin health
    anxiety.ts                      # Anxiety & mood

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
  page.tsx                          # Landing page (card grid of all variants)
  [variant]/page.tsx                # Dynamic route (server component)

app/api/quiz/
  route.ts                          # Variant-aware submission endpoint
  systemPrompt.ts                   # Prompt builder with overlay support

app/admin/results/
  page.tsx                          # Config-driven admin dashboard

app/api/admin/results/
  route.ts                          # Admin API with variant filtering
  pdf/
    route.ts                        # Admin PDF export
    lib/adminPdfTemplate.ts         # Config-driven PDF template

server/
  quizSubmissions.ts                # Storage with normalization + per-variant indexes
  quizResults.ts                    # Result storage

lib/
  quizStorage.ts                    # Variant-scoped localStorage (v2)
  utmStorage.ts                     # UTM tracking
  knowledge/                        # Shared knowledge files (all injected into LLM prompt)
    knowledge.md                    # Bioenergetic health model
    questionaire.md                 # Symptom interpretation guide
    diet_lifestyle_standardized.md  # Diet/lifestyle framework
    metabolism_deep_dive.md         # Energy metabolism deep dive (reasoning framework)
    gut_deep_dive.md                # Gut health deep dive (reasoning framework)
```

---

## Key Design Principle

The system works because of a deliberate asymmetry: **deep shared knowledge, thin variant-specific data, constrained output**.

Five knowledge files are shared across all variants. Three provide the interpretive lens (bioenergetic model, symptom interpretation, diet/lifestyle framework). Two provide deep mechanistic reasoning frameworks (energy metabolism, gut health) with explicit framing to internalize principles rather than reproduce content. They give the agent enough theoretical depth to reason about any health condition. The variant config provides:
- **Questions** that collect the right data points for this condition
- **Prompt overlay** that steers the agent's pattern recognition toward the relevant mechanisms
- **UI copy** that speaks to the prospect's specific concern

The output is always the same shape: personalized patterns + consultation CTA. The variant determines what patterns emerge, not how the system works.

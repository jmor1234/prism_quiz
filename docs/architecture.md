# Architecture Overview

## System Summary

A config-driven health assessment platform. Users take condition-specific quizzes, an LLM analyzes their answers through a bioenergetic framework, and a personalized assessment drives consultation bookings.

**Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS v4, Framer Motion, Claude Opus 4.6, Upstash Redis, Puppeteer (PDF)

---

## Data Flow

```
User visits /quiz/{variant}
    │
    ▼
Server component resolves VariantConfig from registry
    │
    ▼
QuizWizard renders questions from config
    │
    ▼
User answers 11 questions + name
    │
    ▼
POST /api/quiz { variant, name, answers }
    │
    ├─► Validate against dynamic Zod schema (built from config)
    ├─► Save submission to Redis/filesystem
    ├─► Build prompt: knowledge base + prompt overlay + formatted answers
    ├─► Call Claude Opus 4.6
    └─► Return { id, report }
            │
            ▼
    QuizResult renders markdown assessment + booking CTA + PDF download
```

---

## Frontend

### Routes

```
/                           → redirect to /quiz (via next.config)
/quiz                       → redirect to /quiz/root-cause (307)
/quiz/[variant]             → quiz page (server component → client wizard)
/admin/results              → password-protected admin dashboard
```

### Component Hierarchy

```
app/quiz/[variant]/page.tsx          Server component
  └─ generateMetadata()              Per-variant SEO (title, description, OG)
  └─ generateStaticParams()          Pre-renders all 11 variant routes
  └─ QuizClient                      "use client" boundary
       └─ QuizWizard                 Core engine — takes VariantConfig
            ├─ QuestionStep          Dispatcher → routes to type-specific component
            │   ├─ SliderQuestion        Range slider with value display
            │   ├─ YesNoQuestion         Toggle + optional conditional follow-up
            │   ├─ MultiSelectQuestion   Pill-style multi-select buttons
            │   ├─ SingleSelectQuestion  Radio-style single select
            │   └─ FreeTextQuestion      Textarea with hint
            ├─ NameStep              Name input (always last question step)
            ├─ QuizLoading           SVG progress ring + pulsing dots
            └─ QuizResult            Assessment display + CTA + PDF download
```

### Wizard Engine (`quiz-wizard.tsx`)

The central state machine. Driven entirely by `VariantConfig`:

- **State:** `answers: Record<string, unknown>` initialized from config via `buildInitialAnswers()`
- **Navigation:** step counter, total = `questions.length + 1` (questions + name)
- **Validation:** per-type via `isQuestionValid()` — gates the Next button
- **Submit:** POST `{ variant, name, answers }` to `/api/quiz`
- **Retry:** if submission fails, stores `submissionId` in localStorage for retry
- **Persistence:** variant-scoped localStorage (`prism-quiz:{variant}`)
- **Dev tools:** "Fill Test" button generates random valid data per question type
- **Animation:** Framer Motion spring transitions + `useReducedMotion` support

### Styling

- TailwindCSS v4 with CSS custom properties (`--quiz-gold`, `--quiz-cream`, `--quiz-text-on-gold`)
- Radix UI primitives (slider, toggle, dropdown)
- `quiz-theme.ts` exports shared constants: `ACCENT` colors, `questionClass`, `hintClass`
- Dark mode via `next-themes`

---

## Backend

### API Routes

```
POST /api/quiz                    Quiz submission + LLM generation
GET  /api/quiz/result?quizId=     Fetch stored result
POST /api/quiz/pdf                Generate user-facing PDF

GET  /api/admin/results           Paginated submissions (password-protected)
POST /api/admin/results/pdf       Generate admin PDF export
```

### Prompt Architecture

```
System Prompt
├── Context (Prism identity, bioenergetic lens)
├── Knowledge Foundation
│   ├── <bioenergetic_knowledge>      knowledge.md
│   ├── <symptom_interpretation>      questionaire.md
│   └── <diet_lifestyle>              diet_lifestyle_standardized.md
├── Condition-Specific Guidance       variant.promptOverlay (when non-empty)
├── Client's Quiz Answers             formatAnswers(variant, name, answers)
├── Task Instructions
├── Output Format
└── Constraints
```

The three knowledge files are shared across all variants. The `promptOverlay` steers interpretation toward condition-specific mechanisms. `formatAnswers()` uses `promptLabel` fields from the config for concise, LLM-readable output.

### Storage

**Dual-mode:** Upstash Redis in production, filesystem JSON in local dev.

```
Submissions:  quiz-submissions:{uuid}     → { id, createdAt, variant, name, answers }
Results:      quiz-results:{uuid}         → { quizId, report, createdAt }
Index:        quiz-index                  → sorted set (timestamp → uuid)
```

**Backward compatibility:** `normalizeRecord()` on every read converts pre-variant submissions to the new shape. No data migration needed.

**Client storage:** variant-scoped localStorage keys (`prism-quiz:{variant}`). V1→V2 migration for root-cause.

### PDF Generation

Two PDF pipelines, both using Puppeteer with serverless-aware Chromium (`@sparticuz/chromium` on Vercel):

- **User PDF:** markdown report → HTML (remark/rehype) → cover template → PDF
- **Admin PDF:** submission answers + report → admin template → PDF

---

## Config-Driven Quiz Engine

### VariantConfig — the single source of truth

Everything derives from one object per variant:

```
VariantConfig
├── slug, name, description          Identity + SEO
├── questions: QuestionConfig[]      Ordered wizard steps
├── nameField                        Name collection config
├── headline, subtitle               Page metadata
├── resultBanner, ctaText, ctaUrl    Result display
├── promptOverlay                    LLM condition-specific guidance
└── ogImage?                         Social preview
```

### QuestionConfig — 5 types

| Type | UI Component | Initial State | Validation |
|------|-------------|--------------|------------|
| `slider` | Range slider + value display | `default` value | Always valid |
| `yes_no` | Toggle (+ optional follow-up) | `null` or `{ answer: null, followUp: [] }` | Answer selected |
| `multi_select` | Pill buttons | `[]` | At least 1 (unless `required: false`) |
| `single_select` | Radio-style buttons | `null` | Option selected |
| `free_text` | Textarea | `""` | Non-empty (unless `required: false`) |

### How config flows through the system

```
VariantConfig
  ├─► schema.ts          buildSubmissionSchema()    → Zod validator
  ├─► formatAnswers.ts   formatAnswers()            → markdown for LLM prompt
  ├─► systemPrompt.ts    promptOverlay injection    → condition-specific guidance
  ├─► quiz-wizard.tsx    buildInitialAnswers()       → React state
  │                      isQuestionValid()           → step validation
  │                      generateTestData()          → dev test data
  ├─► question-step.tsx  type dispatcher             → correct UI component
  ├─► [variant]/page.tsx generateMetadata()          → SEO tags
  └─► quiz-result.tsx    resultBanner, ctaText       → result display
```

### Variant Registry

```typescript
// lib/quiz/variants/index.ts
getVariant(slug)         → VariantConfig | undefined
getAllVariants()          → VariantConfig[]
getAllVariantSlugs()      → string[]
```

11 variants registered: `root-cause`, `gut`, `fatigue`, `hormones-women`, `testosterone`, `sleep`, `thyroid`, `brain-fog`, `weight`, `skin`, `anxiety`.

---

## Directory Structure

```
app/
├── layout.tsx                          Root layout (fonts, theme, metadata)
├── globals.css                         Global styles + CSS custom properties
├── page.tsx                            Root redirect
├── error.tsx                           Error boundary
├── quiz/
│   ├── page.tsx                        Redirect → /quiz/root-cause
│   └── [variant]/
│       └── page.tsx                    Server component (metadata + static params)
├── admin/
│   └── results/
│       └── page.tsx                    Admin dashboard (client component)
└── api/
    ├── quiz/
    │   ├── route.ts                    Submission + LLM generation
    │   ├── systemPrompt.ts             Prompt builder
    │   ├── result/route.ts             Result retrieval
    │   └── pdf/
    │       ├── route.ts                User PDF generation
    │       └── lib/quizTemplateBuilder.ts
    └── admin/
        └── results/
            ├── route.ts                Admin results listing
            └── pdf/
                ├── route.ts            Admin PDF export
                └── lib/adminPdfTemplate.ts

components/
├── quiz/
│   ├── quiz-client.tsx                 "use client" boundary wrapper
│   ├── quiz-wizard.tsx                 Core wizard engine
│   ├── quiz-loading.tsx                Loading animation
│   ├── quiz-result.tsx                 Result display + CTA + PDF
│   ├── quiz-theme.ts                   Shared styling constants
│   ├── question-step.tsx               Question type dispatcher
│   └── questions/
│       ├── slider-question.tsx
│       ├── yes-no-question.tsx
│       ├── multi-select-question.tsx
│       ├── single-select-question.tsx
│       ├── free-text-question.tsx
│       └── name-step.tsx
├── ui/                                 Radix UI primitives
│   ├── button.tsx
│   ├── input.tsx
│   ├── textarea.tsx
│   ├── slider.tsx
│   ├── toggle.tsx
│   ├── toggle-group.tsx
│   ├── dropdown-menu.tsx
│   ├── mode-toggle.tsx
│   └── theme-provider.tsx
└── ai-elements/
    ├── response.tsx                    Markdown renderer (Streamdown)
    └── loader.tsx                      AI loading spinner

lib/
├── quiz/
│   ├── types.ts                        Core type definitions
│   ├── schema.ts                       Dynamic Zod schema builder
│   ├── formatAnswers.ts                Answer formatter for prompts
│   └── variants/
│       ├── index.ts                    Registry (11 variants)
│       ├── root-cause.ts
│       ├── gut.ts
│       ├── fatigue.ts
│       ├── hormones-women.ts
│       ├── testosterone.ts
│       ├── sleep.ts
│       ├── thyroid.ts
│       ├── brain-fog.ts
│       ├── weight.ts
│       ├── skin.ts
│       └── anxiety.ts
├── pdf/
│   ├── generatePdf.ts                  Puppeteer PDF generation
│   ├── markdownToHtml.ts              Remark/rehype pipeline
│   ├── pdfStyles.ts                    PDF CSS
│   └── prism_transparent.png           Logo asset
├── knowledge/
│   ├── knowledge.md                    Bioenergetic health model
│   ├── questionaire.md                 Symptom interpretation guide
│   └── diet_lifestyle_standardized.md  Diet/lifestyle framework
├── schemas/quiz.ts                     Legacy Zod schemas (admin use)
├── labels/quizLabels.ts                Legacy label maps (admin use)
├── quizStorage.ts                      Variant-scoped localStorage
├── utmStorage.ts                       UTM parameter capture
└── utils.ts                            cn() helper

server/
├── quizSubmissions.ts                  Submission storage (Redis + filesystem)
└── quizResults.ts                      Result storage (Redis + filesystem)
```

# Architecture Overview

## System Summary

A config-driven health assessment platform with three pillars:

- **Quiz flow** (`/quiz/{variant}`) — warm audiences with condition-specific quizzes (12 variants) leading to booking calls. Standard storage namespace (`quiz-*`).
- **Assessment flow** (`/assessment`) — cold traffic from paid ads, 5-question intake, brief personalized 2-paragraph assessment, direct purchase CTA. Separate Redis database via `UPSTASH_ASSESSMENT_REDIS_REST_URL`.
- **Best-life-care intake** (`/quiz/best-life-care`) — extended 38-question deep health intake with fully isolated storage namespace (`bestlife-*` keys, same Redis instance) and dedicated admin (`/admin/best-life-care`). Reuses the same `/api/quiz` route, prompt scaffolding, Exa tools, and 3-tier caching as standard variants — the route branches storage by variant. No chat handoff in v1.

**Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS v4, Framer Motion, Claude Sonnet 4.6 (adaptive thinking, low effort), AI SDK v6, Exa v2 (semantic search), Gemini Flash (extraction), Upstash Redis, Puppeteer (PDF), Dexie (IndexedDB)

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
(forward navigation auto-skips and auto-fills questions whose
hideWhen rule matches; back navigation skips backward likewise)
    │
    ▼
User answers N questions per variant config (11 for standard, 38 for best-life-care)
    │
    ▼
POST /api/quiz { variant, answers, [submissionId for retry] }
    │
    ├─► Resolve storage namespace by variant
    │     ├─► best-life-care → bestlife-* keyspace
    │     └─► all others     → standard quiz-* keyspace
    ├─► Validate against dynamic Zod schema (built from config)
    ├─► Save submission to Redis/filesystem
    ├─► Build system prompt (knowledge + instructions) + user message (answers)
    ├─► Call Claude Sonnet 4.6 with evidence tools (search + read)
    │     └─► Agent searches Exa for research, optionally reads sources
    │         └─► Up to 10 agentic steps (tool calls + final generation)
    └─► Return { id, report }
            │
            ▼
    QuizResult renders markdown assessment with inline citations
    (variant-aware: tracking + PDF endpoint branch on variant.slug)
            │
            ▼
    Save Your Assessment (PDF) | Book a Free Call (gold CTA)
            │                              │
            ▼                              ▼
    /api/{quiz|bestlife}/pdf        Opens booking URL (UTM-tagged)
            │
            ▼
    /explore/{quizId} (standard variants only — not best-life-care in v1)
            │
            ▼
    Multi-turn streaming agent conversation
    (Sonnet 4.6, Exa tools, evidence-based)
            │
            ▼
    Conversation saved to IndexedDB + server
    Engagement events tracked
```

### Assessment Flow (Cold Traffic → Direct Purchase)

```
User clicks paid ad → /assessment
    │
    ▼
Intro screen (framing + "Get Started")
    │
    ▼
5 static preset questions (instant navigation, no API calls between steps)
    Q1: What have you been dealing with? (multi-select)
    Q2: What have you tried so far? (multi-select)
    Q3: How long has this been going on? (single-select)
    Q4: Where are things at right now? (multi-select)
    Q5: Do you feel like you can figure this out on your own? (single-select)
    │  ← Each: chip options + optional free text
    │  ← Progress bar + "X of 5" indicator
    │
    ▼
POST /api/assessment/generate { steps }
    │
    ├─► Validate input
    ├─► Build system prompt (3 knowledge files + task instructions)
    ├─► Call Claude Sonnet 4.6 (single-turn, no tools, no thinking)
    ├─► Save result to Redis/filesystem
    └─► Return { id, report }
            │
            ▼
    AssessmentResult renders 2-paragraph assessment (editorial layout)
            │
            ▼
    Take the Next Step With Prism → booking URL (UTM-tagged via localStorage)
```

---

## Frontend

### Routes

```
/                           → redirect to /quiz (via next.config)
/quiz                       → landing page (card grid of all variants + standalone chat link)
/quiz/[variant]             → intro screen → quiz wizard (server component → client)
                              Includes /quiz/best-life-care (38-question deep intake)
/assessment                 → 5 static questions → AI assessment → purchase CTA
/admin/assessments          → password-protected assessment submissions dashboard
/admin/results              → password-protected admin dashboard (Quiz Results | Conversations tabs)
                              Defensively excludes best-life-care submissions
/admin/best-life-care       → password-protected dedicated dashboard for best-life-care submissions
                              (same ADMIN_PASSWORD env var, isolated from /admin/results)
/explore/[quizId]           → post-quiz agent chat (server component → client)
                              Standard variants only — best-life-care has no chat handoff in v1
/chat                       → redirect to latest thread or create new
/chat/[threadId]            → standalone agent chat with sidebar (server → client)
```

### Component Hierarchy

```
app/quiz/page.tsx                    Server component — landing page
  └─ getAllVariants()                Card grid linking to each /quiz/{slug}

app/quiz/[variant]/page.tsx          Server component
  └─ generateMetadata()              Per-variant SEO (title, description, OG, Twitter)
  └─ generateStaticParams()          Pre-renders all 12 variant routes
  └─ Strips server-only fields       promptOverlay, description
app/quiz/[variant]/opengraph-image.tsx  Dynamic OG image (edge, 1200x630)
app/quiz/[variant]/twitter-image.tsx    Re-exports OG image for Twitter
  └─ QuizClient                      "use client" boundary
       └─ QuizWizard                 Core engine — takes VariantConfig
            ├─ Intro screen (inline)  Headline + subtitle + Start button (before questions)
            ├─ QuestionStep          Dispatcher → routes to type-specific component
            │   ├─ SliderQuestion           Range slider with value display
            │   ├─ YesNoQuestion            Toggle (Yes/No) + optional 3rd "Unsure" button (allowUnsure)
            │   │                           + optional conditional follow-up multi-select
            │   ├─ MultiSelectQuestion      Pill-style multi-select buttons
            │   ├─ SingleSelectQuestion     Radio-style single select
            │   ├─ FreeTextQuestion         Textarea with hint
            │   └─ YesNoWithTextQuestion    Toggle + conditional textarea (shown on Yes/Unsure, hidden on No)
            ├─ QuizLoading           SVG progress ring + pulsing dots
            └─ QuizResult            Assessment display + gold booking CTA + PDF download
                                     Variant-aware: tracking + PDF endpoint branch on variant.slug
                                     (best-life-care → /api/bestlife/*, others → /api/quiz/*)

app/assessment/page.tsx              Server component (metadata, passes bookingUrl from env)
  └─ AssessmentClient                "use client" orchestrator
       ├─ useAssessmentWizard        Core hook (useReducer state machine, 5 static questions)
       ├─ IntroScreen                Framing screen + Get Started button
       ├─ AssessmentStep             Chips + free text (reused for all 5 questions)
       ├─ StepTransition             CSS transition wrapper (react-transition-group)
       ├─ AssessmentLoading          SVG ring + CSS-animated dots during generation
       └─ AssessmentResult           Editorial 2-paragraph report + single purchase CTA (UTM-tagged)
```

### Assessment Wizard (`use-assessment-wizard.ts`)

A `useReducer`-based state machine driving 5 static preset questions with no API calls between steps:

- **Static questions:** All 5 questions defined in `ASSESSMENT_QUESTIONS` array with question text, chip options (`value`/`label`), placeholder, and `multiSelect` flag. Current question derived from `ASSESSMENT_QUESTIONS[stepIndex]` — not stored in state.
- **State machine phases:** `intro` → `answering` (steps 0-4) → `generating` → `result` (with `error` reachable from generation). No name collection — Q5 Next goes straight to generation.
- **Synchronous navigation:** `next()` saves the current answer into `answers[stepIndex]`, builds an `IntakeStep`, and advances to the next question instantly. No API calls, no loading states between questions. Only async call is `generateAssessment()` at the end.
- **Back navigation:** Saves current answer, decrements `stepIndex`, restores previous answer from `answers[]`. Step 0 goes back to intro.
- **Progress:** Computed as `(stepIndex + 1) / 5`. UI shows progress bar + "X of 5" indicator.
- **Persistence:** `lib/assessmentStorage.ts` with versioned schema (v3) storing `name`, `steps`, `answers[]`, `stepIndex`, `resultId`, `result`. Graceful `QuotaExceededError` handling. Hydration restores to the step the user was on.
- **Animation:** CSS transitions via react-transition-group (`StepTransition` wrapper) for step navigation. No framer-motion in the step lifecycle.

### Quiz Wizard Engine (`quiz-wizard.tsx`)

The central state machine. Driven entirely by `VariantConfig`:

- **State:** `answers: Record<string, unknown>` initialized from config via `buildInitialAnswers()` → `initialAnswerFor(q)` (per-type fresh value, also reused by the cascade-reset below)
- **Intro:** `started` boolean — shows headline/subtitle/Start before questions begin
- **Navigation with hideWhen:** `findNextVisibleStep()` walks forward from the next step, auto-filling any hidden question with its `setAnswerTo` value, until landing on a visible one (or returns null to trigger submit). `findPrevVisibleStep()` walks backward past hidden questions. Cascading is automatic: an auto-filled value can satisfy the next question's hideWhen rule.
- **Cascade-reset:** when the user manually changes an answer via `updateAnswer()`, downstream questions whose `hideWhen` references it are recursively reset to their initial values — prevents stale auto-fills from showing pre-selected on questions that just became visible.
- **Validation:** per-type via `isQuestionValid()` — gates the Next button. Auto-filled hidden questions always pass (their `setAnswerTo` is schema-valid).
- **Submit:** POST `{ variant, answers }` to `/api/quiz` (variant always sent — drives storage routing). On retry, sends `{ variant, submissionId }`. Name sent as empty string (collected later by intake agent if needed).
- **Last-step detection:** `isLastVisibleStep` = `findNextVisibleStep() === null`. Drives the Next vs. "Get Your Assessment" button label.
- **Retry:** if submission fails, stores `submissionId` in localStorage for retry
- **Persistence:** variant-scoped localStorage (`prism-quiz:{variant}`)
- **Dev tools:** "Fill Test" button generates random valid data per question type and lands on the last visible step
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
POST /api/quiz                            Quiz submission + LLM generation (rate-limited, cached)
                                          Branches storage by variant: best-life-care → bestlife-*,
                                          all others → standard quiz-*. Same prompt/tools/caching
                                          for every variant.
GET  /api/quiz/result?quizId=             Fetch stored result (standard quiz storage)
POST /api/quiz/pdf                        Generate user-facing PDF (standard quiz storage)
POST /api/quiz/engagement                 Engagement tracking (events + conversations) [standard]

POST /api/bestlife/result                 Fetch stored result (best-life-care storage)
POST /api/bestlife/pdf                    Generate user-facing PDF (best-life-care storage)
POST /api/bestlife/engagement             Engagement tracking [best-life-care]
                                          (parallel routes exist because /api/quiz/{result,pdf,engagement}
                                          only receive quizId — they can't know which keyspace to read)

POST /api/assessment/generate             Assessment generation (Sonnet 4.6, single-turn, no tools, cached)
POST /api/assessment/engagement           Assessment engagement tracking (booking clicks)

POST /api/agent                           Streaming agent conversation (Sonnet 4.6, dual-mode: quiz/standalone)

POST /api/chat/engagement                 Standalone chat tracking (events + conversations)

GET  /api/admin/results                   Paginated quiz submissions + engagement (password-protected)
                                          Defensively excludes best-life-care from listings + dropdown
POST /api/admin/results/pdf               Admin PDF export (standard storage)
POST /api/admin/results/summary           AI conversation summary (Sonnet 4.6) [standard]
GET  /api/admin/assessments               Paginated assessment submissions + engagement (password-protected)
GET  /api/admin/best-life-care            Paginated best-life-care submissions + engagement
POST /api/admin/best-life-care/pdf        Admin PDF export (best-life-care storage)
POST /api/admin/best-life-care/summary    AI conversation summary [best-life-care, parity for future use]
GET  /api/admin/chats                     Standalone chat sessions (password-protected)
POST /api/admin/chats/summary             Generate standalone chat summary (Sonnet 4.6)
```

### Prompt Architecture

The prompt is split into a **system message** and a **user message**. The system message contains all stable context (knowledge, instructions, tools guidance). The user message contains only the quiz answers. Three-tier Anthropic prompt caching via `CacheManager`: tool schemas, system prompt (`cacheControl: ephemeral`, 5-min TTL), and conversation history (`prepareStep` → `applyHistoryCacheBreakpoint`). The ~21K token system message caches after step 1 and reads at 10% cost on subsequent steps. Measured: 95.3% cache hit rate, ~73% cost reduction per generation.

```
System Message
├── Context (Prism identity as evidence-based practice)
├── Knowledge Foundation
│   ├── <bioenergetic_knowledge>         knowledge.md
│   ├── <symptom_interpretation>         questionaire.md
│   └── <diet_lifestyle>                 diet_lifestyle_standardized.md
├── Deep Mechanistic Framework
│   ├── <energy_metabolism_framework>    metabolism_deep_dive.md
│   └── <gut_health_framework>          gut_deep_dive.md
├── Condition-Specific Guidance          variant.promptOverlay (when non-empty)
├── Task Instructions
├── Evidence Guidance                    Why to cite, format, source quality, fabrication rule
├── Output Format
├── Closing Guidance
└── Constraints

User Message
└── Client's Quiz Answers                formatAnswers(variant, name, answers)
```

Five knowledge files are shared across all variants. The first three provide the interpretive lens. The two deep dives provide mechanistic reasoning frameworks -- injected with explicit framing ("use it to think, not to quote") so the LLM internalizes principles rather than regurgitating content. All five are loaded in parallel via `Promise.all` and cached after first load.

The `promptOverlay` steers interpretation toward condition-specific mechanisms. `formatAnswers()` uses `promptLabel` fields from the config for concise, LLM-readable output.

### Assessment Prompt Architecture

Single agent, single-turn generation (`app/api/assessment/generate/prompt.ts`):

- Model: Claude Sonnet 4.6 via `generateText` (no tools, no thinking, no multi-step)
- Knowledge: 3 files -- `knowledge.md` (bioenergetic framework), `metabolism_deep_dive.md` (energy metabolism reasoning), `gut_deep_dive.md` (gut health reasoning). No process details — the landing page handles that.
- Task: 2 paragraphs + closing sentence (conversion-focused, not educational)
  - P1: Connect symptoms through bioenergetic lens, then land on the daily life toll and trajectory — make them feel it
  - P2: Why they can't solve this alone, what continuing the current path means — create conviction to act
  - Closing: direct them to learn about the program (landing page handles process, team, pricing)
- Constraints: plain prose, phone-readable in ~1 minute, "we" as Prism, tough love tone — honest about severity, not hype
- Input: `formatIntake(name, steps)` converts 5 static question answers to markdown
- System prompt caching: `cacheControl: ephemeral` on system message (knowledge files are stable)
- Max duration: 60s (typically completes in 10-20s)
- Logging: token usage, cache breakdown (read/write/uncached/hit%), cost with savings

### Evidence Tools (Quiz + Conversational Agent only)

Two tools built on Exa's semantic search API give the quiz and conversational agents real-time access to scientific literature. The assessment flow does not use tools (speed over depth).

```
Tools (passed to generateText in quiz + agent routes)
├── search    Exa semantic search, 3 results with highlights, category: research paper
└── read      Exa focused excerpts from a known URL, query-filtered highlights
```

### Conversational Agent

Single route (`/api/agent`) serves two modes based on whether `quizId` is present in the request body:

**Post-quiz mode** (`/explore/{quizId}`): Agent already knows the person from quiz answers + assessment. Deepening posture.
**Standalone mode** (`/chat/{threadId}`): Agent starts from zero. Discovery posture. Accessible from quiz index page.

**Shared configuration** (`app/api/agent/route.ts`):
- Model: Claude Sonnet 4.6 with adaptive thinking, low effort
- Tools: search + read + extract_findings (Exa v2 backed)
- Steps: up to 10 (`stopWhen: stepCountIs(10)`)
- Three-tier prompt caching (tool schemas, stable system prompt, conversation history)
- Context management: `clear_thinking`, `clear_tool_uses`, `compact`
- Rate limiting + input validation
- Max duration: 300s

**Agent tools** (`app/api/agent/tools/`):
```
├── search           Exa semantic search, 3 results, category: research paper
├── read             Exa focused highlights from known URL
└── extract_findings Exa full text → Gemini Flash structured extraction (depth tool)
```

**Agent prompt** (`app/api/agent/systemPrompt.ts`):
- Two builders: `buildAgentPrompt()` (post-quiz) and `buildStandalonePrompt()` (standalone)
- Shared: 8 knowledge files, behavioral sections (Consultation, Boundaries, Scope, Evidence, Tone)
- Mode-specific: The Situation, Your Purpose, The Conversation
- Post-quiz dynamic: quiz context (variant, name, answers, assessment) + date
- Standalone dynamic: date only

**Post-quiz frontend** (`app/explore/[quizId]/agent-page.tsx`):
- Auto-trigger hidden first message, hydration-safe
- Chat UI: conversation, messages, tool status, sources, reasoning, prompt input
- Dual persistence: IndexedDB (client) + server (admin)

**Standalone frontend** (`app/chat/[threadId]/chat-page.tsx`):
- No auto-trigger, opening question in empty state
- Thread management sidebar (create, rename, delete)
- Same chat UI components as post-quiz
- Dual persistence: IndexedDB via `lib/chat/thread-store.ts` + server via `server/chatSessions.ts`

### Engagement Tracking

Three parallel tracking systems:

**Quiz engagement** (`server/quizEngagement.ts`): Tracks `pdf_download`, `booking_click` (assessment or agent), `agent_opened`. Keyed by `quiz-engagement:{quizId}`. Visible in `/admin/results`.

**Assessment engagement** (`server/assessmentEngagement.ts`): Tracks `booking_click` from assessment result page. Keyed by `assessment-engagement:{id}` (same Redis instance as assessment results). Visible in `/admin/assessments`.

**Standalone chat** (`server/chatSessions.ts`): Tracks `booking_click` from chat. Keyed by `chat-sessions:{threadId}`. Visible in `/admin/results` (Conversations tab).

Both store conversation transcripts server-side (serialized user/assistant text only).

**On-demand AI summaries** via admin button — Sonnet 4.6 generates concise prose. Quiz summaries include full quiz context; chat summaries are conversation-only.

**Client:** `lib/tracking.ts` — fire-and-forget with `keepalive: true`. Separate functions for quiz (`trackEvent`, `saveConversationRemote`) and chat (`trackChatEvent`, `saveChatConversationRemote`).

### Storage

**Dual-mode:** Upstash Redis in production, filesystem JSON in local dev.

**Standard quiz storage** (12 variants share this namespace):
```
Submissions:    quiz-submissions:{uuid}     → { id, createdAt, variant, name, answers }
Results:        quiz-results:{uuid}         → { quizId, report, createdAt }
Engagement:     quiz-engagement:{uuid}      → { quizId, events, conversation, summary, updatedAt }
Chat sessions:  chat-sessions:{threadId}    → { threadId, events, conversation, summary, createdAt, updatedAt }
Index:          quiz-index                  → sorted set (timestamp → uuid) — global
                quiz-index:{variant}        → sorted set (timestamp → uuid) — per-variant
                chat-sessions-index         → sorted set (timestamp → threadId)
```

On save, submissions are dual-indexed to both the global and per-variant sorted sets. Listing with a variant filter uses the per-variant index (Redis) or filters in-memory (filesystem).

**Best-life-care storage** (fully isolated, same Redis instance, separate key prefix):
```
Submissions:    bestlife-submissions:{uuid}  → { id, createdAt, variant, name, answers }
Results:        bestlife-results:{uuid}      → { id, report, createdAt }
Engagement:     bestlife-engagement:{uuid}   → { quizId, events, conversation, summary, updatedAt }
Index:          bestlife-index               → sorted set (timestamp → uuid)
```
Filesystem fallback: `storage/bestlife-{submissions,results,engagement}/{uuid}.json`.

Same `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars as the standard quiz — no new infrastructure required. The `/api/quiz` route branches storage by variant via a small `getStorage(variant)` helper. The `/admin/results` API defensively filters out `best-life-care` records (belt-and-suspenders since they should never land in `quiz-*` keys anyway).

**Backward compatibility:** `normalizeRecord()` on every standard quiz read converts pre-variant submissions to the new shape. No data migration needed. Old entries only exist in the global index. The bestlife storage modules don't need this since the namespace is new.

**Assessment storage** (separate Redis database via `UPSTASH_ASSESSMENT_REDIS_REST_URL`):
```
Assessment results:      assessment-results:{uuid}      → { id, name, steps, report, createdAt }
Assessment engagement:   assessment-engagement:{uuid}   → { assessmentId, events, updatedAt }
Assessment index:        assessment-index                → sorted set (timestamp → uuid)
```
Filesystem fallback: `storage/assessment-results/{uuid}.json`, `storage/assessment-engagement/{uuid}.json`

Backwards compatible: old records missing `name`/`steps` are normalized with empty defaults on read.

**Client storage:** variant-scoped localStorage keys (`prism-quiz:{variant}`). V1→V2 migration for root-cause. Assessment uses `prism-assessment` key with versioned schema (v3) storing name, steps, answers[], stepIndex, and result.

### PDF Generation

Two PDF pipelines, using Puppeteer with serverless-aware Chromium (`@sparticuz/chromium` on Vercel):

- **Quiz User PDF** (`/api/quiz/pdf`): markdown report → HTML (remark/rehype) → cover template → PDF
- **Admin PDF** (`/api/admin/results/pdf`): variant config → config-driven answer rendering + report + conversation summary (if exists) → admin template → PDF

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
└── promptOverlay                    LLM condition-specific guidance
```

### QuestionConfig — 6 types

| Type | UI Component | Initial State | Validation |
|------|-------------|--------------|------------|
| `slider` | Range slider + value display | `default` value | Always valid |
| `yes_no` | 2-button toggle (+ optional 3rd "Unsure" via `allowUnsure`, + optional follow-up multi-select) | `null` or `{ answer: null, followUp: [] }` | Answer selected (`!== null`) |
| `multi_select` | Pill buttons | `[]` | At least 1 (unless `required: false`) |
| `single_select` | Radio-style buttons | `null` | Option selected |
| `free_text` | Textarea | `""` | Non-empty (unless `required: false`) |
| `yes_no_with_text` | Toggle (Yes/No, + optional Unsure) + conditional textarea | `{ answer: null, text: "" }` | Answer selected (`!== null`); text always optional |

**Cross-cutting optional fields** (available on every type):

- **`hideWhen?: { questionId, is, setAnswerTo }`** — declarative conditional skip. When the upstream question's answer matches `is` (string or string[]), the wizard skips this question and auto-fills its answer with `setAnswerTo`. Cascades naturally through the answer graph. Schema-, prompt-, and admin-compatible (auto-filled values render normally everywhere). Used in best-life-care to hide the wake-up cascade (Q3-Q5) when the user reports they don't wake up, and to hide Q11 when Q10 is N/A.

- **`allowUnsure?: boolean`** *(yes_no and yes_no_with_text only)* — adds a third "Unsure" button between Yes and No. Answer type widens to `boolean | "unsure"`. For `yes_no_with_text`, the textarea shows on Yes OR Unsure (hidden only on No), since notes are useful when the user is uncertain. Used in best-life-care on Q23 (mental health history), Q24 (white tongue coating), Q28 (trigger foods).

### How config flows through the system

```
VariantConfig
  ├─► schema.ts             buildSubmissionSchema()    → Zod validator
  ├─► formatAnswers.ts      formatAnswers()            → markdown for LLM prompt
  ├─► systemPrompt.ts       promptOverlay injection    → condition-specific guidance
  ├─► quiz-wizard.tsx       buildInitialAnswers()      → React state
  │                         isQuestionValid()          → step validation
  │                         generateTestData()         → dev test data
  ├─► question-step.tsx     type dispatcher            → correct UI component
  ├─► [variant]/page.tsx    generateMetadata()         → SEO tags
  ├─► quiz-result.tsx       resultBanner, ctaText      → result display
  ├─► admin/results         AnswerField by type        → config-driven admin display
  └─► adminPdfTemplate.ts   formatAnswerValue by type  → config-driven PDF
```

### Variant Registry

```typescript
// lib/quiz/variants/index.ts
getVariant(slug)         → VariantConfig | undefined
getAllVariants()          → VariantConfig[]
getAllVariantSlugs()      → string[]
```

13 variants registered: `root-cause`, `gut`, `fatigue`, `hormones-women`, `testosterone`, `sleep`, `thyroid`, `brain-fog`, `weight`, `skin`, `anxiety`, `allergies`, `best-life-care`.

`best-life-care` is structurally a registered variant (so it gets the same routing, SEO, prompt, tools, caching, and wizard engine as the others) but is treated as a separate pillar at the storage and admin layers. Its 38 questions include the engine's full feature set: contextual Likert options (per-question phrasing instead of generic "bothersome"), 4 `hideWhen` cascades for skip-and-fill flow, 3 `allowUnsure` opt-ins, 4 `yes_no_with_text` questions for yes/no-plus-elaboration prompts.

---

## Directory Structure

```
app/
├── layout.tsx                          Root layout (fonts, theme, metadata)
├── globals.css                         Global styles + CSS custom properties
├── error.tsx                           Error boundary
├── quiz/
│   ├── page.tsx                        Landing page (card grid + standalone chat link)
│   └── [variant]/
│       ├── page.tsx                    Server component (metadata + static params)
│       ├── opengraph-image.tsx         Dynamic OG image (edge, 1200x630)
│       └── twitter-image.tsx           Re-exports OG image for Twitter
├── explore/
│   └── [quizId]/
│       ├── page.tsx                    Post-quiz agent server component
│       └── agent-page.tsx              Post-quiz agent client component
├── chat/
│   ├── layout.tsx                      Standalone chat layout
│   ├── page.tsx                        Redirect to latest thread
│   └── [threadId]/
│       ├── page.tsx                    Thread server component
│       └── chat-page.tsx               Thread client component (chat + sidebar)
├── assessment/
│   ├── page.tsx                        Server component (metadata)
│   └── error.tsx                       Error boundary
├── admin/
│   ├── results/
│   │   └── page.tsx                    Quiz admin dashboard (Quiz Results | Conversations tabs)
│   ├── assessments/
│   │   └── page.tsx                    Assessment admin dashboard (submissions + engagement)
│   └── best-life-care/
│       └── page.tsx                    Dedicated best-life-care admin (no chat tab, no variant filter)
└── api/
    ├── quiz/
    │   ├── route.ts                    Submission + LLM generation (with tools)
    │   ├── tools.ts                    Exa v2 client + search/read tools + logging
    │   ├── systemPrompt.ts             System/user message builder
    │   ├── result/route.ts             Result retrieval
    │   ├── engagement/route.ts         Engagement tracking endpoint
    │   └── pdf/
    │       ├── route.ts                User PDF generation
    │       └── lib/quizTemplateBuilder.ts
    ├── assessment/
    │   ├── types.ts                    Shared IntakeStep type
    │   ├── generate/
    │   │   ├── route.ts                Assessment generation (Sonnet 4.6, single-turn, no tools, cached)
    │   │   └── prompt.ts               Assessment prompt + 3 knowledge file loader
    │   └── engagement/
    │       └── route.ts                Assessment engagement tracking endpoint
    ├── bestlife/                       Parallel routes for best-life-care (variant-naive endpoints)
    │   ├── result/route.ts             Result fetch from bestlife-results storage
    │   ├── pdf/route.ts                User-facing PDF (reuses shared template builder)
    │   └── engagement/route.ts         Engagement tracking → bestlife-engagement
    ├── chat/
    │   └── engagement/route.ts         Standalone chat tracking endpoint
    ├── agent/
    │   ├── route.ts                    Streaming agent (Sonnet 4.6, dual-mode, caching, logging)
    │   ├── systemPrompt.ts             Shared sections + dual prompt builders
    │   ├── tools/
    │   │   ├── index.ts                Exports agentTools
    │   │   ├── searchTool.ts           Exa semantic search
    │   │   ├── readTool.ts             Exa focused highlights
    │   │   ├── exaSearch/              Shared Exa v2 client + rate limiter
    │   │   └── depthTool/              Full text → Gemini Flash extraction
    │   └── lib/
    │       ├── cacheManager.ts         Three-tier prompt caching
    │       ├── rateLimit.ts            IP-based rate limiting
    │       ├── inputValidation.ts      Message validation
    │       ├── llmRetry.ts             Exponential backoff
    │       └── retryConfig.ts          Retry config
    └── admin/
        ├── results/
        │   ├── route.ts                Admin quiz results listing (+ engagement join)
        │   ├── summary/route.ts        AI quiz conversation summary (Sonnet 4.6)
        │   └── pdf/
        │       ├── route.ts            Admin PDF export
        │       └── lib/adminPdfTemplate.ts
        ├── assessments/
        │   └── route.ts                Admin assessment listing (+ engagement join)
        ├── best-life-care/             Dedicated admin endpoints for best-life-care
        │   ├── route.ts                Listing (+ engagement join from bestlife storage)
        │   ├── summary/route.ts        AI summary (parity with /admin/results — used if chat is added later)
        │   └── pdf/route.ts            Admin PDF export (reuses shared adminPdfTemplate)
        └── chats/
            ├── route.ts                Admin standalone chat sessions listing
            └── summary/route.ts        AI standalone chat summary (Sonnet 4.6)

components/
├── quiz/
│   ├── quiz-client.tsx                 "use client" boundary wrapper
│   ├── quiz-wizard.tsx                 Core wizard engine
│   ├── quiz-loading.tsx                Loading animation
│   ├── quiz-result.tsx                 Result display + PDF download + action CTAs
│   ├── quiz-theme.ts                   Shared styling constants
│   ├── question-step.tsx               Question type dispatcher
│   └── questions/
│       ├── slider-question.tsx
│       ├── yes-no-question.tsx                    (supports allowUnsure 3-button mode)
│       ├── multi-select-question.tsx
│       ├── single-select-question.tsx
│       ├── free-text-question.tsx
│       └── yes-no-with-text-question.tsx          (toggle + conditional textarea on Yes/Unsure)
├── ui/                                 Radix UI primitives + shadcn
│   ├── button.tsx
│   ├── input.tsx
│   ├── textarea.tsx
│   ├── slider.tsx
│   ├── toggle.tsx
│   ├── toggle-group.tsx
│   ├── dropdown-menu.tsx
│   ├── collapsible.tsx
│   ├── mode-toggle.tsx
│   └── theme-provider.tsx
├── ai-elements/
│   ├── conversation.tsx                Auto-scroll container
│   ├── message.tsx                     User/assistant bubbles
│   ├── response.tsx                    Markdown renderer (Streamdown)
│   ├── tool-status.tsx                 Research/reading indicator
│   ├── sources.tsx                     Collapsible citation drawer
│   ├── reasoning.tsx                   Collapsible thinking block
│   ├── prompt-input.tsx                Text input + send/stop
│   └── loader.tsx                      Loading spinner
├── assessment/
│   ├── assessment-client.tsx           "use client" orchestrator (phase switch + layout)
│   ├── use-assessment-wizard.ts        Core hook (useReducer state machine, 5 static questions)
│   ├── intro-screen.tsx                Framing screen + Get Started button
│   ├── assessment-step.tsx             Chips + free text question UI
│   ├── step-transition.tsx             CSS transition wrapper (react-transition-group)
│   ├── assessment-loading.tsx          Generation loading screen (CSS-animated dots)
│   └── assessment-result.tsx           Editorial 2-paragraph report + single purchase CTA (UTM-tagged)
└── chat-sidebar.tsx                    Standalone chat thread list (CRUD)

hooks/
├── use-agent-persistence.ts            Post-quiz IndexedDB + server persistence
├── use-chat-persistence.ts             Standalone chat IndexedDB + server persistence
└── use-mobile.ts                       Mobile detection

lib/
├── quiz/
│   ├── types.ts                        Core type definitions
│   ├── schema.ts                       Dynamic Zod schema builder
│   ├── formatAnswers.ts                Answer formatter for prompts
│   └── variants/
│       ├── index.ts                    Registry (13 variants)
│       ├── best-life-care.ts           38-question deep intake (uses hideWhen, allowUnsure,
│       │                               yes_no_with_text, contextual Likert options)
│       └── [12 standard variant configs]
├── agent/
│   └── thread-store.ts                 Post-quiz Dexie IndexedDB (keyed by quizId)
├── chat/
│   └── thread-store.ts                 Standalone Dexie IndexedDB (threads + messages)
├── pdf/
│   ├── generatePdf.ts                  Puppeteer PDF generation
│   ├── markdownToHtml.ts              Remark/rehype pipeline
│   ├── pdfStyles.ts                    PDF CSS
│   └── prism_transparent.png           Logo asset
├── assessment/
│   └── formatIntake.ts                Intake steps → markdown for assessment prompt
├── assessmentStorage.ts               Assessment localStorage persistence (versioned)
├── knowledge/                          9 knowledge files
│   ├── knowledge.md                    Bioenergetic health model
│   ├── questionaire.md                 Symptom interpretation guide
│   ├── diet_lifestyle_standardized.md  Diet/lifestyle framework
│   ├── metabolism_deep_dive.md         Energy metabolism reasoning framework
│   ├── gut_deep_dive.md               Gut health reasoning framework
│   ├── evidence_hierarchy.md           Evidence framework
│   ├── takehome.md                     Physiological markers
│   ├── prism_process.md               Prism's process
│   └── intake_intelligence.md         Distilled symptom probing guide for intake agent
├── tracking.ts                         Fire-and-forget tracking (quiz + standalone chat)
├── message-utils.ts                    Text extraction + citation parsing
├── quizStorage.ts                      Variant-scoped localStorage
├── utmStorage.ts                       UTM parameter capture
└── utils.ts                            cn() helper

server/
├── quizSubmissions.ts                  Quiz submission storage (Redis + filesystem)
├── quizResults.ts                      Quiz result storage (Redis + filesystem)
├── quizEngagement.ts                   Quiz engagement storage (Redis + filesystem)
├── bestLifeSubmissions.ts              Best-life-care submission storage (bestlife-* keys, same Redis)
├── bestLifeResults.ts                  Best-life-care result storage (bestlife-* keys)
├── bestLifeEngagement.ts               Best-life-care engagement storage (bestlife-* keys)
├── assessmentResults.ts                Assessment storage — name, steps, report (separate Redis DB + filesystem)
├── assessmentEngagement.ts             Assessment engagement — booking clicks (separate Redis DB + filesystem)
└── chatSessions.ts                     Standalone chat storage (Redis + filesystem)
```

# Architecture Overview

## System Summary

A config-driven health assessment platform with two entry paths. The **quiz flow** serves warm audiences with condition-specific quizzes leading to booking calls. The **assessment flow** serves cold traffic from paid ads with an AI-driven intake leading to direct purchase.

**Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS v4, Framer Motion, Claude Opus 4.6, Claude Sonnet 4.6, AI SDK v6, Exa v2 (semantic search), Gemini Flash (extraction), Upstash Redis, Puppeteer (PDF), Dexie (IndexedDB)

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
    ├─► Build system prompt (knowledge + instructions) + user message (answers)
    ├─► Call Claude Opus 4.6 with evidence tools (search + read)
    │     └─► Agent searches Exa for research, optionally reads sources
    │         └─► Up to 5 agentic steps (tool calls + final generation)
    └─► Return { id, report }
            │
            ▼
    QuizResult renders markdown assessment with inline citations
            │
            ▼
    Save Your Assessment (PDF) | Talk to Our Team | Go Deeper on Your Results
            │                              │
            ▼                              ▼
    Opens booking URL              Navigates to /explore/{quizId}
    (UTM-tagged)                          │
                                          ▼
                                   Agent auto-triggers first message
                                          │
                                          ▼
                                   Multi-turn streaming conversation
                                   (Opus 4.6, Exa tools, evidence-based)
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
Intro screen (name + "Start Assessment")
    │
    ▼
Q1: Static health goals (multi-select chips + free text)
    │
    ▼
POST /api/assessment/intake { steps: [Q1] }
    │
    ├─► Sonnet 4.6 generates next question + contextual options
    ├─► Returns { question, options, freeTextPlaceholder, status, progressEstimate }
    │
    ▼
Q2+: Dynamic questions (agent-generated, personalized to accumulated context)
    │  ← Client sends full step history on each call
    │  ← Agent threads user's words into subsequent questions
    │
    ▼ (loop until status === "optional" or "complete")
    │
    ├── "optional": user can skip or answer one more follow-up
    └── "complete": proceed to assessment
            │
            ▼
POST /api/assessment/generate { name, steps }
    │
    ├─► Validate input
    ├─► Build system prompt (knowledge + narrative arc instructions)
    ├─► Call Claude Opus 4.6 with evidence tools (search + read)
    │     └─► Up to 5 agentic steps
    ├─► Save result to Redis/filesystem
    └─► Return { id, report }
            │
            ▼
    AssessmentResult renders markdown assessment with inline citations
            │
            ▼
    Single purchase CTA → external purchase page
```

---

## Frontend

### Routes

```
/                           → redirect to /quiz (via next.config)
/quiz                       → landing page (card grid of all variants + standalone chat link)
/quiz/[variant]             → intro screen → quiz wizard (server component → client)
/assessment                 → AI-driven intake wizard → assessment → purchase CTA
/explore/[quizId]           → post-quiz agent chat (server component → client)
/chat                       → redirect to latest thread or create new
/chat/[threadId]            → standalone agent chat with sidebar (server → client)
/admin/results              → password-protected admin dashboard (Quiz Results | Conversations tabs)
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
            │   ├─ SliderQuestion        Range slider with value display
            │   ├─ YesNoQuestion         Toggle + optional conditional follow-up
            │   ├─ MultiSelectQuestion   Pill-style multi-select buttons
            │   ├─ SingleSelectQuestion  Radio-style single select
            │   └─ FreeTextQuestion      Textarea with hint
            ├─ NameStep              Name input (always last question step)
            ├─ QuizLoading           SVG progress ring + pulsing dots
            └─ QuizResult            Assessment display + CTA + PDF download

app/assessment/page.tsx              Server component (metadata)
  └─ AssessmentClient                "use client" orchestrator
       ├─ useAssessmentWizard        Core hook (useReducer state machine)
       ├─ IntroScreen                Name input + Start button
       ├─ AssessmentStep             Unified chips + free text (Q1 static + Q2+ dynamic)
       ├─ AssessmentStepSkeleton     Loading placeholder between API calls
       ├─ StepTransition             AnimatePresence direction-aware wrapper
       ├─ AssessmentLoading          SVG ring + dots during generation
       └─ AssessmentResult           Markdown report + single purchase CTA
```

### Assessment Wizard (`use-assessment-wizard.ts`)

A `useReducer`-based state machine driving the AI-powered intake flow:

- **State machine phases:** `intro` → `goals` → `loading_step` ↔ `answering` → `generating` → `result` (with `error` reachable from any async phase)
- **Stateless intake agent:** Client accumulates full `IntakeStep[]` history, sends all of it on each API call. Agent sees entire context fresh each time.
- **Dynamic questions:** After Q1 (static health goal chips), every subsequent question + options are generated by the intake agent (Sonnet 4.6) based on accumulated context
- **Back navigation:** Stored `questionHistory[]` of API responses enables restoring previous questions + answers
- **Skip:** When agent returns `status: "optional"`, user can skip to assessment generation
- **Double-click guard:** `isSubmitting` ref prevents duplicate step submissions
- **Persistence:** `lib/assessmentStorage.ts` with versioned schema, graceful `QuotaExceededError` handling
- **Animation:** Framer Motion spring transitions mask API latency between steps (skeleton → real content swap)

### Quiz Wizard Engine (`quiz-wizard.tsx`)

The central state machine. Driven entirely by `VariantConfig`:

- **State:** `answers: Record<string, unknown>` initialized from config via `buildInitialAnswers()`
- **Intro:** `started` boolean — shows headline/subtitle/Start before questions begin
- **Navigation:** step counter, total = `questions.length + 1` (questions + name); back from step 0 returns to intro
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
POST /api/quiz                    Quiz submission + LLM generation (rate-limited)
GET  /api/quiz/result?quizId=     Fetch stored result
POST /api/quiz/pdf                Generate user-facing PDF
POST /api/quiz/engagement         Engagement tracking (events + conversations)

POST /api/assessment/intake       AI intake step generation (Sonnet 4.6, structured output)
POST /api/assessment/generate     Assessment generation (Opus 4.6, evidence tools, rate-limited)

POST /api/agent                   Streaming agent conversation (Opus 4.6, dual-mode: quiz/standalone)

POST /api/chat/engagement         Standalone chat tracking (events + conversations)

GET  /api/admin/results           Paginated submissions + engagement (password-protected)
POST /api/admin/results/pdf       Generate admin PDF export
POST /api/admin/results/summary   Generate AI conversation summary (Sonnet 4.6)
GET  /api/admin/chats             Standalone chat sessions (password-protected)
POST /api/admin/chats/summary     Generate standalone chat summary (Sonnet 4.6)
```

### Prompt Architecture

The prompt is split into a **system message** and a **user message**. The system message contains all stable context (knowledge, instructions, tools guidance). The user message contains only the quiz answers. This split enables Anthropic prompt caching across the multi-step tool loop: the ~84KB system message caches after step 1 and reads at 10% cost on subsequent steps.

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

Two agents with separate prompts:

**Intake Agent** (`app/api/assessment/intake/prompt.ts`):
- Model: Claude Sonnet 4.6 via `generateObject` (structured output)
- System prompt: role, context (cold traffic), 5 core areas to cover, optional depth guidance, tone
- Knowledge: `intake_intelligence.md` (distilled symptom probing guide -- what details differentiate health complaints bioenergetically)
- User message: formatted accumulated steps (or "Begin the intake" if empty)
- Output schema: `{ question, options[], freeTextPlaceholder, status, progressEstimate }`
- No tools, no thinking -- fast structured generation

**Assessment Agent** (`app/api/assessment/generate/prompt.ts`):
- Same knowledge foundation as quiz agent (5 files), same evidence tools (search + read)
- Different task: narrative arc (reflect situation → show connections → reframe past attempts → arrive at root-cause approach)
- Includes "About Prism" section for natural positioning (cold traffic has no prior context)
- No `promptOverlay` -- single experience, intake data provides all specificity
- Closing guides toward Prism's team-based approach; UI provides purchase CTA separately
- Input: `formatIntake(name, steps)` converts dynamic intake steps to markdown

### Evidence Tools

Two tools built on Exa's semantic search API give the agent real-time access to scientific literature during assessment generation. Prism is an evidence-based brand -- inline citations ground the agent's bioenergetic reasoning in real research.

```
Tools (passed to generateText)
├── search    Exa semantic search, 3 results with highlights, category: research paper
└── read      Exa focused excerpts from a known URL, query-filtered highlights
```

**Separation of concerns:**
- **System prompt** (`# Evidence` section): why to cite, citation format (`[phrase](URL)`), source quality (peer-reviewed only), fabrication rule
- **Tool descriptions**: how each tool works, when to use each, operational guidance (e.g., parallel calls for different angles)
- No overlap between prompt and tool descriptions

**Agent configuration** (`generateText` in `route.ts`):
- Model: Claude Opus 4.6
- Tools: search + read (Exa-backed)
- Steps: up to 5 (`stopWhen: stepCountIs(5)`)
- Thinking: adaptive (model decides per-step), low effort (knowledge base does the heavy lifting)
- Context management: keep all thinking blocks across steps
- Max duration: 120s (tool calls add latency)

**Tool logging:**
- Each tool logs query, results, latency, and estimated tokens on execution
- Route logs a post-generation summary: tool counts, total tokens injected, step count, input/output tokens, wall-clock duration

### Conversational Agent

Single route (`/api/agent`) serves two modes based on whether `quizId` is present in the request body:

**Post-quiz mode** (`/explore/{quizId}`): Agent already knows the person from quiz answers + assessment. Deepening posture.
**Standalone mode** (`/chat/{threadId}`): Agent starts from zero. Discovery posture. Accessible from quiz index page.

**Shared configuration** (`app/api/agent/route.ts`):
- Model: Claude Opus 4.6 with adaptive thinking, low effort
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

Two parallel tracking systems, both visible in the admin dashboard (tab toggle: Quiz Results | Conversations).

**Quiz engagement** (`server/quizEngagement.ts`): Tracks `pdf_download`, `booking_click` (assessment or agent), `agent_opened`. Keyed by `quiz-engagement:{quizId}`.

**Standalone chat** (`server/chatSessions.ts`): Tracks `booking_click` from chat. Keyed by `chat-sessions:{threadId}`.

Both store conversation transcripts server-side (serialized user/assistant text only).

**On-demand AI summaries** via admin button — Sonnet 4.6 generates concise prose. Quiz summaries include full quiz context; chat summaries are conversation-only.

**Client:** `lib/tracking.ts` — fire-and-forget with `keepalive: true`. Separate functions for quiz (`trackEvent`, `saveConversationRemote`) and chat (`trackChatEvent`, `saveChatConversationRemote`).

### Storage

**Dual-mode:** Upstash Redis in production, filesystem JSON in local dev.

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

**Backward compatibility:** `normalizeRecord()` on every read converts pre-variant submissions to the new shape. No data migration needed. Old entries only exist in the global index.

**Assessment storage** (separate Redis database via `UPSTASH_ASSESSMENT_REDIS_REST_URL`):
```
Assessment results:  assessment-results:{uuid}  → { id, report, createdAt }
```
Filesystem fallback: `storage/assessment-results/{uuid}.json`

**Client storage:** variant-scoped localStorage keys (`prism-quiz:{variant}`). V1→V2 migration for root-cause. Assessment uses `prism-assessment` key with versioned schema storing name, steps, questionHistory, and result.

### PDF Generation

Two PDF pipelines, both using Puppeteer with serverless-aware Chromium (`@sparticuz/chromium` on Vercel):

- **User PDF:** markdown report → HTML (remark/rehype) → cover template → PDF
- **Admin PDF:** variant config → config-driven answer rendering + report + conversation summary (if exists) → admin template → PDF

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

12 variants registered: `root-cause`, `gut`, `fatigue`, `hormones-women`, `testosterone`, `sleep`, `thyroid`, `brain-fog`, `weight`, `skin`, `anxiety`, `allergies`.

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
│   └── results/
│       └── page.tsx                    Admin dashboard (Quiz Results | Conversations tabs)
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
    │   ├── intake/
    │   │   ├── route.ts                Intake step generation (Sonnet 4.6, generateObject)
    │   │   └── prompt.ts               Intake prompt + intake_intelligence.md loader
    │   └── generate/
    │       ├── route.ts                Assessment generation (Opus 4.6, generateText + tools)
    │       ├── prompt.ts               Assessment prompt + 5 knowledge file loader
    │       └── tools.ts                Exa search + read tools
    ├── chat/
    │   └── engagement/route.ts         Standalone chat tracking endpoint
    ├── agent/
    │   ├── route.ts                    Streaming agent (Opus 4.6, dual-mode, caching, logging)
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
        │   ├── route.ts                Admin results listing (+ engagement join)
        │   ├── summary/route.ts        AI quiz conversation summary (Sonnet 4.6)
        │   └── pdf/
        │       ├── route.ts            Admin PDF export
        │       └── lib/adminPdfTemplate.ts
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
│       ├── yes-no-question.tsx
│       ├── multi-select-question.tsx
│       ├── single-select-question.tsx
│       ├── free-text-question.tsx
│       └── name-step.tsx
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
│   ├── use-assessment-wizard.ts        Core hook (useReducer state machine + API calls)
│   ├── intro-screen.tsx                Name input + Start button
│   ├── assessment-step.tsx             Unified chips + free text question UI
│   ├── step-transition.tsx             AnimatePresence direction-aware wrapper
│   ├── assessment-loading.tsx          Generation loading screen
│   └── assessment-result.tsx           Report display + single purchase CTA
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
│       ├── index.ts                    Registry (12 variants)
│       └── [12 variant configs]
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
├── quizSubmissions.ts                  Submission storage (Redis + filesystem)
├── quizResults.ts                      Result storage (Redis + filesystem)
├── quizEngagement.ts                   Quiz engagement storage (Redis + filesystem)
├── chatSessions.ts                     Standalone chat storage (Redis + filesystem)
└── assessmentResults.ts                Assessment result storage (separate Redis DB + filesystem)
```

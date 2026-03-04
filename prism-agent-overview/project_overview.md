# Prism Health — Conversational Health Agent

A conversational AI agent that helps prospects understand their health through a bioenergetic lens. Replaces a static 10-question quiz with an open-ended conversation where every exchange delivers value and builds depth simultaneously. Funnel position: Dalton's Content → Conversation → Book a Free Consultation.

## The Core Mechanism

People book calls when they feel understood in a way they couldn't have produced for themselves. The delta between what they understood about their health before and after the interaction is what creates pull toward the consultation.

The agent gives everything it genuinely can: mechanism explanations, symptom connections, pattern identification, bioenergetic context. It holds back nothing within its boundaries. The gap that drives booking is *real*: protocols, supplements, and specific interventions require comprehensive data (labs, physiological assessments, full health history) and expert review that a conversation cannot provide.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Primary Agent (Sonnet 4.6)                   │
│     Bioenergetic lens · Adaptive thinking · Evidence-based    │
├──────────────────┬──────────────────┬────────────────────────┤
│  retrieve_       │   read_          │    extract_            │
│  evidence        │   source         │    findings            │
│  (Exa search)    │  (Exa highlights)│   (extraction)         │
└──────────────────┴──────────────────┴────────────────────────┘
         ▲                                      ▲
         │          Static Knowledge            │
         │  (injected into system prompt)       │
         ├── knowledge.md (bioenergetic framework)
         ├── questionaire.md (symptom interpretation)
         ├── diet_lifestyle_standardized.md (lifestyle lens)
         └── prism_process.md (service process)
```

| Tool | What It Does | Latency |
|------|-------------|---------|
| **retrieve_evidence** | Exa semantic search — finds studies and sources relevant to a claim, returns results with highlighted excerpts | ~1-3s |
| **read_source** | Focused evidence from a specific URL (10K chars) — default "go deeper" step | ~100-300ms |
| **extract_findings** | Retrieves full content from a URL → extracts structured findings you can cite | ~3-7s |

Evidence retrieval is filtered through the bioenergetic lens — the agent does not retrieve neutrally. The framework guides reasoning; evidence makes it concrete and credible with real citations.

## Knowledge Architecture

### Static Knowledge (injected into system prompt at runtime)

Six markdown files read from `app/api/chat/data/` at module load and injected into the stable cached portion of the system prompt:

| File | Purpose | Size |
|------|---------|------|
| `knowledge.md` | Bioenergetic worldview — the causal model of health. Root causes, cascades, interconnections. | ~32K |
| `questionaire.md` | Symptom interpretation guide — maps 33 symptoms to mechanistic implications. | ~13K |
| `diet_lifestyle_standardized.md` | How environment and nutrition affect health — mechanisms, not prescriptions. | ~4K |
| `takehome.md` | Physiological markers — what objective body signals (pulse, temperature, urine, stool, tongue) reveal. | ~3K |
| `evidence_hierarchy.md` | How Prism thinks about evidence — Bayesian approach, blind spots of conventional hierarchy. | ~5K |
| `prism_process.md` | How Prism's service works — 9-step journey from consultation to follow-up. | ~4K |

### Dynamic Knowledge (via evidence retrieval tools at runtime)

The agent uses retrieve_evidence/read_source/extract_findings tools to find studies, evidence, and citations that ground its explanations. All retrieved evidence is interpreted through the bioenergetic framework — it supports and deepens the static knowledge, never overrides it.

## System Prompt Structure

The system prompt is organized as **Context → Knowledge → Behavior**:

1. The Situation (who the agent is, Prism context)
2. Who You're Talking To (audience understanding)
3. Where Prism Sits (identity, positioning, evidence-based principle)
4. Knowledge Foundation (bioenergetic knowledge, symptom guide, diet/lifestyle, physiological markers, evidence framework — ~61KB)
5. Prism's Process (service details)
6. Your Purpose (intent, core values, value delivery)
7. The Conversation (listen early, cite from first insight, deepen, preview of methodology)
8. The Consultation (reactive: user triggers it, educate on Prism first, booking link last)
9. Boundaries (constraints)
10. Scope (health topics only, redirect off-topic, generous with health-adjacent)
11. Evidence (interpretive stance, citation expectation)
12. Tone (style)

The agent absorbs context and knowledge before receiving behavioral instructions, so every instruction is informed by the domain knowledge already in context.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Agent | Vercel AI SDK (`streamText`, `generateObject`, `generateText`, tool system) |
| Primary Model | Claude Sonnet 4.6 (orchestration, health reasoning, synthesis + adaptive thinking, low effort) |
| Depth Extraction | Gemini 3 Flash (single-document extraction) |
| Search | Exa API (semantic search with highlights, 5 results/query, 1200 chars/URL; read: 10K chars/URL) |
| Frontend | React 19 + Tailwind v4 + ShadCN/ui + Streamdown + next-themes + `useChat` from `@ai-sdk/react` |
| Voice | OpenAI Whisper API (direct REST, no SDK dependency) |
| PDF Export | Puppeteer + unified (remark-parse → remark-gfm → remark-rehype → rehype-stringify) |
| Validation | Zod (tool input schemas, structured outputs) |

## Request Lifecycle

```
User sends message
  → POST /api/chat
  → Rate limit check (per-IP sliding window: 10/min, 120/hr) — reject 429 if exceeded
  → Input validation (message array, length) — reject 400 if invalid
  → Three-tier prompt caching applied (tools, system prompt + knowledge, history)
  → streamText(Sonnet 4.6) with adaptive thinking (low effort)

  Sonnet reasons through bioenergetic lens
  → May make tool calls for evidence retrieval (parallel via AI SDK)

  retrieve_evidence (per call):
    → Exa semantic search (results with highlights)
    → Returns directly to Sonnet — interpreted through bioenergetic framework

  Sonnet evaluates
    → Making a claim? → retrieve_evidence for citation
    → Need more from a source? → read_source with focused query
    → Need comprehensive extraction? → extract_findings on specific URLs
    → Need different angle? → Additional retrieve_evidence calls

  → Streamed response to frontend via UI message stream
  → Frontend renders markdown with Streamdown
  → Tool status indicators show during tool execution
  → Sources drawer populated from parsed citation URLs
```

## Conversation Flow

1. **Opening** — UI displays: "What's your biggest health struggle right now, or your most important health goal?" The user types their answer. The agent receives this as the first message (no opening message from the agent).
2. **Early exchanges** — Agent keeps responses short, focuses on understanding the person's situation through targeted questions. Value early is in the quality of questions, not explanations.
3. **Deepening** — As the agent accumulates understanding, it begins explaining mechanisms, identifying patterns, and drawing connections through the bioenergetic lens. Claims are grounded in cited evidence via inline citations.
4. **Boundaries** — Agent explains what's going on freely but does not prescribe protocols, supplements, diets, or specific interventions. When asked "what should I do?" — honest about needing comprehensive data and expert review.
5. **Consultation** — When the conversation naturally reaches the point where the next step is clear, the agent guides toward booking a free consultation. Honest about what the call involves (understanding their situation + walking through service options). Link delivered contextually, not forced. If someone resists booking, the agent can offer curated research as a genuine alternative.

## Simulation

Password-protected testing system at `/sim`. A simulator LLM (Gemini 3 Flash) roleplays as different prospect archetypes against the real Prism agent. The Prism agent doesn't know it's being simulated — it runs through the same `POST /api/chat` endpoint with the same system prompt and tools.

**How it works:** Select an archetype → click Start → the archetype's opening message is sent to the Prism agent → after the agent responds, a 15-second pause, then Gemini Flash generates the next prospect message based on the conversation so far → loop continues until stopped or 30 turns.

**Archetypes (15):**
- The Skeptic — guarded, has tried everything, tests the advisor
- The Over-Sharer — dumps detailed health history, eager, long messages
- The Minimal Responder — one-word answers, has to be drawn out
- The Doctor Hopper — 10+ providers, knows medical terminology, challenging
- The Casually Curious — healthy, intellectually interested, not urgent
- The Hormonal Struggler — post-birth-control hormonal chaos, frustrated, wants mechanisms
- The Protocol Seeker — biohacker doing "everything right," declining on every metric
- The Worried Parent — here for her child, not herself, emotionally charged
- The Life-Crumbler — health collapsed alongside life crisis, needs biology not therapy
- The Framework Loyalist — strict carnivore, identity fused with diet, ideological resistance
- The Catastrophizer — health-anxious, mixes real symptoms with anxiety noise
- The Reluctant Proxy — sent by spouse, zero buy-in, zero health vocabulary
- The Returner — interacted before, didn't convert, back with PCOS/fertility urgency
- The Conspiracy-Curious — mixes valid concerns with rabbit-hole thinking, tests framework bridging
- The Stream-of-Consciousness — narrative thinker, health info buried in stories, tests deep listening

**Endpoints:**
- `GET /api/sim/archetypes` — lists available archetypes with opening messages
- `POST /api/sim/auth` — password verification against `ADMIN_PASSWORD`
- `POST /api/simulate` — Gemini Flash generates next prospect message (role-flipped conversation history)

## Infrastructure

- **Request safeguards** — Per-IP sliding window rate limiting (10 req/min, 120 req/hr) + input validation (message length). In-memory, no external dependencies. Disabled in development. System prompt Scope section handles semantic off-topic detection at zero additional cost.
- **Three-tier prompt caching** — Tool schemas, stable system prompt (instructions + knowledge files), conversation history. 5-minute TTL. `prepareStep` advances the history cache breakpoint on every step. The stable cached block includes all four knowledge files (~59KB, ~15,900 tokens).
- **Context management** — Server-side Anthropic context editing. Thinking blocks preserved for cache stability. Old tool results cleared at 100K tokens. Full compaction at 150K.
- **Retry + timeout** — Per-phase configurable (extraction). Exponential backoff with jitter. Error classification.
- **Exa rate limiting** — Promise-chained dispatch at 10 QPS (33% cushion below Exa's 15 QPS limit).

## Project Structure

```
prism-agent/
├── app/
│   ├── page.tsx                    # Server redirect → /chat
│   ├── layout.tsx                  # Root layout (Geist fonts, metadata, viewport, ThemeProvider)
│   ├── globals.css                 # Tailwind + ShadCN + Streamdown typography + animations
│   ├── chat/
│   │   ├── layout.tsx              # Server — SidebarProvider (cookie-based) + AppSidebar + SidebarInset
│   │   ├── page.tsx                # Client redirect → latest thread or create new
│   │   └── [threadId]/
│   │       ├── page.tsx            # Server — awaits params, renders ChatPage with key={threadId}
│   │       └── chat-page.tsx       # Client — usePersistedChat → ChatView
│   ├── sim/
│   │   ├── layout.tsx              # Server — SimGateLoader + SidebarProvider + AppSidebar
│   │   ├── page.tsx                # Client redirect → latest sim thread or create new
│   │   └── [threadId]/
│   │       ├── page.tsx            # Server — awaits params, renders SimPage with key={threadId}
│   │       └── sim-page.tsx        # Client — usePersistedChat + auto-play loop + sim controls
│   ├── components/                 # Page-specific components
│   │   ├── message-renderer.tsx    # Part dispatcher (text, reasoning, file, tool)
│   │   ├── chat-composer.tsx       # Composer (voice, attachments, submit)
│   │   ├── voice-button.tsx        # MediaRecorder → /api/transcribe → text injection
│   │   └── attachment-button.tsx   # File dialog trigger (uses AttachmentsContext)
│   └── api/
│       ├── chat/                   # Backend (see docs/backend_directory_structure.md)
│       │   ├── route.ts            # Streaming endpoint
│       │   ├── systemPrompt.ts     # Prism agent prompt + knowledge injection (cached/dynamic split)
│       │   ├── data/               # Static knowledge files (injected into system prompt)
│       │   │   ├── knowledge.md
│       │   │   ├── questionaire.md
│       │   │   ├── diet_lifestyle_standardized.md
│       │   │   ├── takehome.md
│       │   │   ├── evidence_hierarchy.md
│       │   │   ├── prism_process.md
│       │   │   └── archetypes/     # Simulation prospect personas (15 archetypes)
│       │   │       ├── skeptic.md
│       │   │       ├── over-sharer.md
│       │   │       ├── minimal-responder.md
│       │   │       ├── doctor-hopper.md
│       │   │       ├── casually-curious.md
│       │   │       ├── hormonal-struggler.md
│       │   │       ├── protocol-seeker.md
│       │   │       ├── worried-parent.md
│       │   │       ├── life-crumbler.md
│       │   │       ├── framework-loyalist.md
│       │   │       ├── catastrophizer.md
│       │   │       ├── reluctant-proxy.md
│       │   │       ├── returner.md
│       │   │       ├── conspiracy-curious.md
│       │   │       └── stream-of-consciousness.md
│       │   ├── lib/                # Infrastructure (rate limiting, validation, caching, retry, config)
│       │   └── tools/              # retrieve_evidence, read_source, extract_findings
│       ├── sim/
│       │   ├── archetypes/
│       │   │   └── route.ts        # GET — list archetypes with opening messages
│       │   └── auth/
│       │       └── route.ts        # POST — password verification
│       ├── simulate/
│       │   └── route.ts            # POST — Gemini Flash generates next prospect message
│       ├── transcribe/
│       │   └── route.ts            # Voice transcription (OpenAI Whisper API)
│       └── export-pdf/
│           ├── route.ts            # PDF generation endpoint
│           └── lib/                # markdownToHtml, generatePdf, pdfStyles
├── components/
│   ├── ai-elements/                # Reusable chat UI components
│   │   ├── conversation.tsx        # Auto-scroll (use-stick-to-bottom)
│   │   ├── message.tsx             # Message + MessageContent (CVA variants)
│   │   ├── response.tsx            # Streamdown markdown rendering
│   │   ├── reasoning.tsx           # Collapsible thinking block
│   │   ├── tool-status.tsx         # Animated tool status indicator
│   │   ├── sources.tsx             # Collapsible sources drawer
│   │   ├── prompt-input.tsx        # Compound input with attachments
│   │   ├── message-copy.tsx        # Copy button
│   │   ├── message-pdf-button.tsx  # PDF export button (POST → blob download)
│   │   └── loader.tsx              # Spinner primitive
│   ├── chat-view.tsx               # Shared presentational chat UI (messages, tool status, sources, composer)
│   ├── app-sidebar.tsx             # Thread list sidebar (CRUD, inline rename, hover-reveal actions)
│   ├── sim-gate.tsx                # Sim password gate (useSyncExternalStore + sessionStorage)
│   ├── sim-gate-loader.tsx         # Client wrapper — next/dynamic({ ssr: false }) for SimGate
│   ├── theme-provider.tsx          # next-themes wrapper (system/light/dark, localStorage)
│   └── ui/                         # ShadCN primitives (button, collapsible, dropdown-menu, input, mode-toggle, scroll-area, separator, sheet, sidebar, skeleton, textarea, tooltip)
├── hooks/
│   ├── use-mobile.ts               # Mobile detection (768px breakpoint)
│   ├── use-thread-persistence.ts   # Hydrate from IndexedDB on mount, save on stream completion
│   └── use-persisted-chat.ts       # useChat + useThreadPersistence combined
├── lib/
│   ├── utils.ts                    # cn() + canonicalizeUrlForDedupe()
│   ├── message-utils.ts            # extractMessageText() + extractCitationUrls()
│   └── thread-store.ts             # Dexie/IndexedDB persistence (ThreadMeta + messages, CRUD, SSR-safe)
├── docs/                           # Architecture documentation + design specs
│   ├── project_overview.md         # This file
│   ├── backend_directory_structure.md
│   ├── frontend_directory_structure.md
│   └── design-integration/         # Original design specs
│       ├── overview.md             # Foundational design outline
│       └── sysprompt.md            # System prompt spec (reference)
├── .env.local                      # API keys (ANTHROPIC, GOOGLE, EXA, OPENAI) + PRISM_BOOKING_LINK
└── ARCHITECTURE.md                 # Complete specification
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API (primary agent) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API (depth extraction) |
| `EXA_API_KEY` | Exa API (evidence retrieval + read) |
| `OPENAI_API_KEY` | OpenAI Whisper (voice transcription) |
| `PRISM_BOOKING_LINK` | Consultation booking URL (injected into system prompt) |
| `RATE_LIMIT_PER_MINUTE` | Request rate limit per IP per minute (default: 10) |
| `RATE_LIMIT_PER_HOUR` | Request rate limit per IP per hour (default: 120) |
| `MAX_MESSAGE_LENGTH` | Max characters per user message (default: 15000) |

## Key Constraints

1. Evidence retrieval is filtered through the bioenergetic lens — the agent does not retrieve neutrally
2. Being evidence-based is a core identity principle — claims should be grounded in cited evidence
3. No prescriptions, diagnosis, or medical claims — insight and mechanism explanation only
4. Knowledge files are static and cached — loaded once at module init, included in the stable cached prompt block
5. No `any` type — strict TypeScript throughout
6. Exa queries are semantic (natural language descriptions), not keywords
7. The agent's first response engages directly with what the user shared — the UI already asked the opening question
8. Early exchanges prioritize understanding (questions) over explanations

## Current Status

**Implemented:** System prompt with bioenergetic knowledge injection (Context → Knowledge → Behavior structure, including Scope for off-topic detection), evidence retrieval tools (retrieve_evidence, read_source, extract_findings), three-tier caching, context management, retry/timeout, Exa rate limiting, request safeguards (per-IP rate limiting, input validation), voice input, chat UI with streaming markdown, tool status indicators, sources drawer, message copy, PDF export, dark mode, booking link integration, simulation agent with 5 prospect archetypes, conversation persistence (IndexedDB via Dexie), threaded chat sidebar with CRUD/rename/delete, URL-based thread routing for both `/chat` and `/sim` routes.


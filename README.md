# Prism Quiz

A config-driven health assessment platform built for [Prism Health](https://prism.miami). Users complete a brief structured intake, an LLM agent generates an evidence-cited assessment grounded in Prism's bioenergetic framework, and the conversation can continue as a multi-turn agent chat. Three audience pillars share a single engine; for the full reference see [`docs/architecture.md`](./docs/architecture.md).

---

## The three pillars

The same core engine — Next.js routes, prompt scaffolding, Exa tools, three-tier caching — serves three distinct audiences with three distinct strategies:

| Pillar | Route | Audience | Storage |
|---|---|---|---|
| **Standard quizzes** | `/quiz/{variant}` (12 variants) | Warm — already in Prism's orbit | `quiz-*` (Upstash) |
| **Cold-traffic assessment** | `/assessment` | Cold — first touch from paid ads | `assessment-*` (separate Redis DB) |
| **Best-life-care intake** | `/quiz/best-life-care` (hidden) | B2B partner client base | `bestlife-*` (same Redis, isolated keys) |

### Standard quizzes — value-first lead gen for a warm audience

Twelve condition-specific variants (root-cause, gut, fatigue, hormones-women, testosterone, sleep, thyroid, brain-fog, weight, skin, anxiety, allergies) for people who already know Prism — typically through founder Dalton's "Analyze and Optimize" content. Strategy: **lead with substantive value**, not a sales pitch. The 11-question intake produces a research-cited assessment that genuinely educates. From there, the user can optionally continue into a follow-up chat that doubles as a personalized consultation: an agent that is both a bioenergetic expert *and* a contextualizer of Prism's services. As patterns surface in the conversation, the agent ties what it's learned about *this specific person* back to which parts of Prism's process and team would be most relevant for them. Booking emerges from understanding, never from pressure.

### Cold-traffic assessment — fast, direct, conversion-focused

A separate flow for paid-ad traffic that doesn't know Prism yet. Strategy: **quick, heavy-hitting value upfront** — no patience window for a 38-question intake or an open-ended chat. Five static questions, single-turn LLM (no tools, no thinking, ~10s generation), and a 2-paragraph assessment built around a "felt-toll → can't-solve-alone → act" arc. Tough-love tone — honest about severity, not hype. Single direct purchase CTA, UTM-tagged. Different reporting and audience profile, so it lives in a separate Redis DB entirely.

### Best-life-care intake — deep B2B partner intake

A 38-question deep health intake built specifically for one of Prism's B2B partners. Hidden from the public `/quiz` listing — only the partner's users reach it via direct URL. Reuses the entire core engine (same model, prompt scaffolding, Exa tools, caching) but with isolated storage and a dedicated admin dashboard at `/admin/best-life-care` so partner submissions never mix with Prism's own lead-gen funnel. No chat handoff in v1 — the partner's flow ends at the assessment + booking CTA.

### Plus: standalone chat as a side door

Alongside the three pillars, the same chat agent is reachable directly at `/chat/{threadId}` — also surfaced as a "Not sure where to start? Chat with our health agent directly" card at the top of the `/quiz` index. Strategy: **lowest-friction entry point** for visitors who don't fit any of the 12 condition-specific quizzes, don't want to commit to a multi-step intake, or just want to ask a question directly. It's the same agent that powers the post-quiz follow-up — same dual job (bioenergetic expert + personalized Prism services contextualizer), same Exa evidence tools — but with a *discovery* posture instead of *deepening*: it starts cold, prompts the user to share what brought them here, and builds understanding from there. A sidebar manages multiple threads so users can keep ongoing conversations. Storage lands in `chat-sessions:{threadId}` and surfaces in `/admin/results` under the Conversations tab. Strategically, it captures intent that would otherwise bounce off the quiz card grid.

---

## Core user flow

Walking the warm-audience path end-to-end:

1. **Land** on `/quiz/{variant}` ([`app/quiz/[variant]/page.tsx`](./app/quiz/[variant]/page.tsx)). Server component resolves the `VariantConfig` from the registry ([`lib/quiz/variants/`](./lib/quiz/variants/)) and renders the wizard.
2. **Wizard** ([`components/quiz/quiz-wizard.tsx`](./components/quiz/quiz-wizard.tsx)) walks the user through one question per screen. Step transitions use `react-transition-group` + CSS — deliberately not Framer Motion on the hot path (see [`docs/animation-gpu-pitfalls.md`](./docs/animation-gpu-pitfalls.md) for why). State persists to variant-scoped `localStorage` for resume-on-refresh.
3. **Submit** posts `{ variant, answers }` to [`app/api/quiz/route.ts`](./app/api/quiz/route.ts). The route resolves the storage namespace by variant, validates against a Zod schema generated from the config, saves the submission, then calls Claude Sonnet 4.6 with the Exa search/read tools.
4. **Generate.** The agent can search literature, read sources, reason, search again — up to 10 steps — before writing the final assessment with inline citations.
5. **Result** renders in [`components/quiz/quiz-result.tsx`](./components/quiz/quiz-result.tsx). Three CTAs: book a free call (gold, primary), continue the conversation with the chat agent, or download a PDF. Each fires its own engagement event (`booking_click`, `agent_opened`, `pdf_download`).
6. **(Optional) Continue.** Standard variants link to `/explore/{quizId}` ([`app/explore/[quizId]/agent-page.tsx`](./app/explore/[quizId]/agent-page.tsx)) — a streaming agent conversation that already knows the user from their quiz answers and assessment. The agent auto-fires a hidden first message so it opens the conversation warmly. Best-life-care doesn't expose this in v1.

The cold assessment flow is shorter: 5 static questions → single-turn LLM (no tools, no thinking) → 2-paragraph copy aimed at conversion → direct purchase CTA.

---

## Agentic architecture

### Model

Claude Sonnet 4.6 with adaptive thinking (low effort), via [AI SDK v6](https://sdk.vercel.ai/) (`@ai-sdk/anthropic`). The same model serves the quiz route, the conversational agent, and the assessment generator. Thinking is enabled because evidence-gathering benefits from interleaved reasoning between tool calls — but the effort is kept low to keep latency reasonable.

### Prompt structure

The system message (~21K tokens for the full agent prompt) carries knowledge + instructions. The user message carries either the formatted quiz answers (quiz route) or the live chat turns (agent route — quiz context lands in a *dynamic* system segment alongside the cached *stable* one). Knowledge has a deliberate two-tier framing:

- **Interpretive lens** — `knowledge.md`, `questionaire.md`, `diet_lifestyle_standardized.md`. The framework the model uses to read symptoms.
- **Mechanistic deep dives** — `metabolism_deep_dive.md`, `gut_deep_dive.md`. Explicitly framed in the prompt as *"use it to think, not to quote."* The goal is internalized reasoning, not regurgitation.

Per-variant `promptOverlay` gets injected when non-empty to steer interpretation toward the variant's domain.

### Three-tier prompt caching

This is the killer optimization. Without caching, every step of an agentic loop re-pays for the entire 21K-token system prompt. With caching, it reads at ~10% cost after step 1.

[`app/api/agent/lib/cacheManager.ts`](./app/api/agent/lib/cacheManager.ts) applies Anthropic's `cacheControl: ephemeral` (5-min TTL) at three levels:

1. **Tool schemas** — stable across all calls.
2. **System prompt** — the big one. Knowledge + instructions + variant overlay.
3. **Conversation history** — a breakpoint via `prepareStep` that caches the running transcript so each subsequent agent step doesn't re-process prior turns.

Measured: **95.3% cache hit rate, ~73% cost reduction** per generation.

### Agentic loop

`stopWhen: stepCountIs(10)` caps each generation at ten model steps. Within those, the model freely interleaves `search` → `read` → reasoning → final write. Quiz route gets two tools (`search`, `read`); the agent route gets a third (`extract_findings`) for deeper sourcing during open conversation.

### Dual-mode agent

A single route — [`app/api/agent/route.ts`](./app/api/agent/route.ts) — serves two surfaces, distinguished by whether `quizId` is in the request body:

- **Post-quiz mode** (`/explore/{quizId}`) — agent is briefed with the user's variant, name, answers, and full assessment. Posture is *deepening*: take what the assessment surfaced and go further with the user. Auto-fires a hidden first message on mount so the agent opens the conversation warmly using their name.
- **Standalone mode** (`/chat/{threadId}`) — agent starts cold, no quiz context. Posture is *discovery*: opening question prompts the user to share what brought them here. Sidebar manages multiple threads, persisted to IndexedDB ([`lib/chat/thread-store.ts`](./lib/chat/thread-store.ts)) and mirrored to the server.

Both modes give the agent a deliberate dual job: **bioenergetic expert who explains mechanisms with cited evidence**, *and* **personalized contextualizer of Prism's services**. The system prompt explicitly avoids proactive booking pitches — the agent waits until the user asks "what should I do" or "how does this work," then connects what it's already surfaced about their specific patterns to which parts of Prism's process and team would be most relevant. The booking link only appears when the user opts in. This is what makes the chat function as a soft consultation rather than a sales handoff.

Same model, same tools, same caching, same retry/rate-limit lib. Different prompt builders (`buildAgentPrompt` vs `buildStandalonePrompt` in [`app/api/agent/systemPrompt.ts`](./app/api/agent/systemPrompt.ts)).

---

## Exa integration

The system uses [Exa](https://exa.ai) (`exa-js` v2) as its evidence layer rather than open web search. All tool implementations live in [`app/api/agent/tools/`](./app/api/agent/tools/).

Three tools, each with a clear job:

- **`search`** ([`searchTool.ts`](./app/api/agent/tools/searchTool.ts)) — semantic search, 3 results with highlights, `category: "research paper"`. The model's first move when it needs evidence. Used by the quiz route and the agent.
- **`read`** ([`readTool.ts`](./app/api/agent/tools/readTool.ts)) — query-filtered focused excerpts from a known URL. The model's follow-up move when a search hit looks promising. Used by the quiz route and the agent.
- **`extract_findings`** ([`depthTool/depthTool.ts`](./app/api/agent/tools/depthTool/depthTool.ts)) — Exa full text → Gemini Flash structured extraction. The "depth" tool, agent-only. Quiz doesn't need it because the quiz is single-shot; the agent uses it during open conversation when the user wants to dig into a paper.

**Why Exa.** Exa is a state-of-the-art web knowledge layer built specifically for LLM agents — not retrofitted from a consumer search product. It understands semantic meaning, so the agent asks precise contextually scoped questions and gets back cleaned, query-filtered highlights (a few hundred tokens of the most relevant prose per source) instead of raw HTML to parse. The agent can stay shallow with semantic search when scanning broadly, or go deep with full-text retrieval and Gemini-Flash extraction when a single paper deserves close reading. The `category: "research paper"` filter is a useful bonus that aligns with Prism's evidence policy of citing only primary scientific sources — but the deeper reason is that Exa is the right *shape* for an agent's context window and reasoning loop in a way that open web search isn't.

**The fabrication guard.** The system prompt explicitly forbids citing sources the tools didn't return — an unsourced explanation is always preferable to a fabricated citation. Citations are threaded as inline markdown links (`[phrase](URL)`) so they read as natural prose, not academic footnotes.

The cold-traffic assessment flow deliberately doesn't use tools — speed wins over depth for paid-ad audiences.

---

## Config-driven engine

`VariantConfig` ([`lib/quiz/types.ts`](./lib/quiz/types.ts)) is the single source of truth. One declarative object per variant propagates through roughly ten destinations (Zod schema, prompt overlay, wizard state + validation, UI dispatch, SEO, result copy, admin display, PDF). Adding a variant ≈ adding one config file.

Six question types as a discriminated union: `slider | yes_no | multi_select | single_select | free_text | yes_no_with_text`. Two cross-cutting optionals any type can adopt: **`hideWhen`** (declarative skip-and-fill that cascades through the answer graph as auto-fills satisfy downstream rules) and **`allowUnsure`** (third "Unsure" button on yes/no questions). This is why best-life-care, with 38 questions and complex skip logic, didn't need engine changes the 11-question variants didn't already exercise.

---

## Storage

Three namespaces, one per pillar. Dual-mode adapter: [Upstash Redis](https://upstash.com) in production, filesystem JSON in local dev — same code path, environment-detected.

| Namespace | Used by | Backend |
|---|---|---|
| `quiz-*` | 12 standard variants | `UPSTASH_REDIS_REST_URL` |
| `bestlife-*` | best-life-care | Same Redis instance, isolated key prefix |
| `assessment-*` | cold assessment | **Separate Redis DB** via `UPSTASH_ASSESSMENT_REDIS_REST_URL` |

Storage adapters live in [`server/`](./server/). The `/api/quiz` route picks one via a small `getStorage(variant)` branch — the only place in the engine that knows about variant-specific storage.

---

## Stack

Next.js 15 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · AI SDK v6 (Anthropic) · `exa-js` v2 · `@ai-sdk/google` (Gemini Flash for extraction) · Upstash Redis · Puppeteer + `@sparticuz/chromium` (PDF) · Dexie (IndexedDB) · `react-transition-group` + Framer Motion · Zod 4 · Radix UI primitives.

---

## Repo map

```
app/                   Next.js App Router
  quiz/                Public landing + per-variant quiz route
  assessment/          Cold-traffic 5Q flow
  explore/[quizId]/    Post-quiz agent chat (standard variants)
  chat/                Standalone agent chat with sidebar
  admin/               Password-gated dashboards (results, assessments, best-life-care, chats)
  api/                 Quiz LLM, agent (dual-mode), assessment generator, PDF, admin endpoints

components/
  quiz/                Wizard engine + 6 question type components
  assessment/          Assessment wizard (useReducer state machine)
  ai-elements/         Conversation, message, tool status, sources, reasoning, prompt input
  ui/                  Radix + shadcn primitives

lib/
  quiz/                VariantConfig types, schema builder, formatAnswers, 13 variants
  knowledge/           9 markdown files — bioenergetic framework + deep dives
  agent/, chat/        Dexie IndexedDB stores
  pdf/                 Puppeteer pipeline

server/                Storage adapters (Upstash + filesystem fallback)
  quiz*, bestLife*, assessment*, chatSessions

docs/
  architecture.md             Full E2E reference (650 lines)
  animation-gpu-pitfalls.md   Why react-transition-group on the hot path
```

---

## Further reading

- [`docs/architecture.md`](./docs/architecture.md) — comprehensive end-to-end reference: every route, every endpoint, every storage namespace, the prompt architecture in detail, the engagement tracking model.
- [`docs/animation-gpu-pitfalls.md`](./docs/animation-gpu-pitfalls.md) — production lessons on Framer Motion, AnimatePresence, and Chrome GPU crashes. Explains the wizard's CSS-transition choice.

# Backend Directory Structure

```
app/api/chat/
├── route.ts                              # POST endpoint — rate limiting, validation, streaming, caching, tool registration
├── systemPrompt.ts                       # Prism agent prompt + knowledge injection (cached/dynamic split)
│
├── data/                                 # Static knowledge files (read at module init, injected into system prompt)
│   ├── knowledge.md                      # Bioenergetic framework — worldview, root causes, cascades (~32K)
│   ├── questionaire.md                   # Symptom interpretation guide — 33 symptom-to-mechanism mappings (~13K)
│   ├── diet_lifestyle_standardized.md    # How environment and nutrition affect health — mechanisms (~4K)
│   ├── takehome.md                       # Physiological markers — pulse, temperature, urine, stool, tongue (~3K)
│   ├── evidence_hierarchy.md             # Evidence framework — Bayesian approach, hierarchy blind spots (~5K)
│   ├── prism_process.md                  # Prism's service process — 9-step client journey (~4K)
│   └── archetypes/                       # Simulation prospect personas — 15 archetypes (used by /api/simulate)
│       ├── skeptic.md                    # Guarded, tried everything, tests trust-building
│       ├── over-sharer.md               # Dumps detailed history, tests synthesis
│       ├── minimal-responder.md         # One-word answers, tests question quality
│       ├── doctor-hopper.md             # 10+ providers, medical terminology, tests depth
│       ├── casually-curious.md          # Intellectually interested, tests substance without sales
│       ├── hormonal-struggler.md        # Post-birth-control, tests hormonal mechanism clarity
│       ├── protocol-seeker.md           # Biohacker, tests recommendation boundary
│       ├── worried-parent.md            # Here for child, tests pediatric gut-immune engagement
│       ├── life-crumbler.md             # Health collapsed with life crisis, tests emotional grounding
│       ├── framework-loyalist.md        # Carnivore-committed, tests ideological reframing
│       ├── catastrophizer.md            # Health-anxious, tests signal extraction from anxiety noise
│       ├── reluctant-proxy.md           # Sent by spouse, tests zero-buy-in engagement
│       ├── returner.md                  # Prior interaction, PCOS/fertility, tests re-engagement
│       ├── conspiracy-curious.md        # Mixes valid concerns with rabbit holes, tests framework bridging
│       └── stream-of-consciousness.md   # Narrative thinker, tests deep listening and extraction
│
├── lib/
│   ├── cacheManager.ts                   # Three-tier Anthropic prompt caching (tools, system, history)
│   ├── rateLimit.ts                      # Sliding window rate limiter (per-IP, per-minute + per-hour) + IP extraction
│   ├── inputValidation.ts                # Request validation (message array, message length) before LLM call
│   ├── llmRetry.ts                       # Timeout + exponential backoff retry wrapper for LLM calls
│   └── retryConfig.ts                    # Per-phase timeout/retry/backoff configuration (extraction only)
│
└── tools/
    ├── researchTool/
    │   ├── researchTool.ts               # retrieve_evidence — Exa semantic search, returns highlights to primary agent
    │   │
    │   └── exaSearch/
    │       ├── exaClient.ts              # Exa SDK wrapper — searchExa() + getHighlights() + getContents()
    │       ├── rateLimiter.ts            # Promise-chained dispatch limiter (10 QPS, 33% cushion)
    │       └── types.ts                  # ExaSearchResult, ExaSearchResponse, SearchOptions
    │
    ├── readTool/
    │   └── readTool.ts                   # read_source — focused highlights from a specific URL via custom query
    │
    └── depthTool/
        ├── depthTool.ts                  # extract_findings — retrieve full content → extract structured findings
        ├── types.ts                      # Finding, ExtractionOutput, DepthToolOutput
        │
        └── extraction/
            ├── agent.ts                  # Gemini 3 Flash → structured findings via generateObject
            ├── prompt.ts                 # getExtractionPrompt() — instructions + document formatting
            └── schema.ts                 # Zod schema: findings[] (insight, evidence) + summary
```

## System Prompt Structure

`systemPrompt.ts` reads all six knowledge files from `data/` synchronously at module load time via `fs.readFileSync`. These are interpolated into the prompt template along with `PRISM_BOOKING_LINK` from env. The result is a single large stable string that gets cached by Anthropic's prompt caching.

The prompt is organized as **Context → Knowledge → Behavior**:

1. Context sections (The Situation, Who You're Talking To, Where Prism Sits)
2. Knowledge injections (Knowledge Foundation with ~61KB of domain knowledge, Prism's Process)
3. Behavioral instructions (Your Purpose, The Conversation, The Consultation, Boundaries, Scope, Evidence, Tone)

This structure ensures the agent absorbs all domain knowledge before receiving instructions on what to do with it.

```
systemPrompt.ts (module init)
  → fs.readFileSync: knowledge.md, questionaire.md, diet_lifestyle_standardized.md, takehome.md, evidence_hierarchy.md, prism_process.md
  → process.env.PRISM_BOOKING_LINK
  → Interpolates into SYSTEM_PROMPT_STABLE template literal
  → buildSystemPrompt(date) returns { stable, dynamic }
    → CacheManager wraps stable with cache_control ephemeral
    → dynamic (just date) sent uncached
```

The `buildSystemPrompt` interface is unchanged — `cacheManager.ts` and `route.ts` require no modifications when knowledge files are updated.

## Data Flow

```
route.ts
  → extractIp(req) → requestRateLimiter.check(ip) — reject 429 if exceeded
  → req.json() → validateInput(messages) — reject 400 if invalid
  → streamText(Sonnet 4.6, tools, adaptive thinking, low effort)
  → System prompt: context → knowledge → behavioral instructions
  → Tool calls execute via AI SDK:

  retrieveEvidenceTool (retrieve_evidence) (~1-3s)
    → Exa semantic search (5 results, highlights at 1200 chars/URL)
    → Returns results with highlights directly to Sonnet
    → Agent interprets through bioenergetic lens, cites inline

  readSourceTool (read_source) (~100-300ms)
    → Exa getContents with highlights (10000 chars, focused query)
    → Returns excerpts directly to Sonnet — default "go deeper" step

  extractFindingsTool (extract_findings) (~3-7s)
    Phase 1: getContents (exaClient)   → full text from Exa Contents
    Phase 2: extraction/agent.ts       → structured findings with evidence

  Reasoning between tool calls handled natively by adaptive thinking (interleaved thinking)
```

## Key Infrastructure

| File | Purpose |
|------|---------|
| `systemPrompt.ts` | Prism agent prompt with runtime knowledge injection. Reads 6 data files + booking link env var at module init. Context → Knowledge → Behavior structure (includes Scope section for off-topic detection). Stable/dynamic split for caching. |
| `cacheManager.ts` | Three-tier prompt caching: tool schemas, system prompt (stable/dynamic split), conversation history. 5-min TTL. `applyHistoryCacheBreakpoint()` advances the history cache boundary on every step. Stable block now ~17,700 tokens (prompt + knowledge files). Context management configured in `route.ts`. |
| `rateLimit.ts` | Sliding window rate limiter for `POST /api/chat`. Per-IP, two windows: 10 req/min + 120 req/hr. In-memory Map, no external dependencies. Disabled in development. Includes `extractIp()` for Vercel `x-forwarded-for` header. |
| `inputValidation.ts` | Request validation before LLM call. Checks: messages array exists, last message is from user, message text under 15K chars. Returns user-facing error messages. |
| `llmRetry.ts` | `withRetry(fn, phase)` — AbortSignal timeout, exponential backoff with jitter, error classification (retryable vs non-retryable), Retry-After header respect. |
| `retryConfig.ts` | Extraction phase: 25s timeout, 2 attempts. Env-overridable. |
| `rateLimiter.ts` (exaSearch) | Promise-chained dispatch at 10 QPS (configurable via `EXA_RATE_LIMIT_QPS`). Controls dispatch timing, not execution — requests run concurrently once dispatched. |

## Tool Registration

Tools are registered in `route.ts` with semantic names that reflect their purpose as evidence retrieval, not information search:

| Registration Key | Export | File | Description |
|-----------------|--------|------|-------------|
| `retrieve_evidence` | `retrieveEvidenceTool` | `researchTool.ts` | Find studies and sources relevant to a claim. Nearly instantaneous. |
| `read_source` | `readSourceTool` | `readTool.ts` | Get focused evidence from a specific source. Nearly instantaneous. |
| `extract_findings` | `extractFindingsTool` | `depthTool.ts` | Extract specific findings and evidence from a dense source. |

## Simulation Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/sim/archetypes` | Lists available archetypes with display names and opening messages. Reads from `data/archetypes/*.md`. |
| `POST /api/sim/auth` | Password verification against `ADMIN_PASSWORD` env var. Returns `{ ok: boolean }`. |
| `POST /api/simulate` | Generates next prospect message via Gemini 3 Flash. Takes conversation history + archetype ID + password. Flips message roles for Gemini's perspective (prospect = assistant, Prism = user). |

The simulation system tests the real Prism agent through the same `POST /api/chat` endpoint — no mocks, no shortcuts.

## Model Allocation

| Role | Model | Where |
|------|-------|-------|
| Primary Agent | Sonnet 4.6 | `route.ts` — health reasoning, bioenergetic analysis, evidence retrieval, user-facing synthesis |
| Depth Extraction | Gemini 3 Flash | `extraction/agent.ts` — fast single-document extraction |
| Prospect Simulation | Gemini 3 Flash | `simulate/route.ts` — roleplays prospect archetypes for testing |

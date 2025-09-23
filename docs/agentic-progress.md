# Agentic Progress & UI: First Principles

This document explains how long-running agentic tool processes produce rich, dynamic UI in this project. It covers the mental model, backend emissions, transport stream, and frontend rendering patterns so a new contributor can confidently extend or modify the experience.

## Core mental model

- Unit of UX: streaming message parts, not monolithic responses.
- Two-world contract: stochastic planner (model) + deterministic tools (typed, side-effect explicit).
- Progress is data: tools emit small, typed progress events that the UI renders immediately.
- Progressive disclosure: show aggregates first (chips, bars), reveal detail on intent (expandables/virtualized lists).

## Data contract (types that flow)

The UI stream can carry "data-*" parts beyond text/reasoning. For research, each phase emits:

- `data-research-session`: overall session status and objective counts.
- `data-research-objective`: per-objective status and phase. Optional enriched context for UI chips:
  - `focusAreas: string[]`, `keyEntities: string[]`, `categories: string[]`.
- `data-research-phase`: per-phase progress with optional details.
  - `details.summary` (optional): compact counts like `{ queries, hits, unique }` (Searching).
  - `details.samples` (optional): a few domains/URLs `{ url, domain?, title? }[]` for credibility without flooding.
  - `details.queries` (optional): query strings. Query‑generation emits the full list; the UI caps display in Pipeline and shows all in Details.
  - `details.subphase` (optional): `'retrieval' | 'sqa' | 'analysis' | 'consolidation'` to narrate analyzing sub-steps.
  - `details.metrics` (optional): fine-grained counters
    - `fetched { ok, total }`, `highSignal { ok, total }`, `analyzed { current, total }`, `consolidated { current, total }`.
- Transient helpers: `data-research-operation`, `data-search-progress`, `data-research-error`.
- Tool status (transient): `data-tool-status` for think/memory tools — `{ toolName, action, timestamp }`.

Collections, curated sources, and claim spans:
- `data-research-collection` (persistent list updates): `{ id, kind, action, total?, items[] }`
  - `kind`: `search_hits | unique_urls | retrieved | high_signal | analyzed | consolidated | citations`.
  - `action`: `replace | append` for streaming in chunks.
- `data-research-sources` (curated list for Sources block): `{ objectiveId?, items[] }`.
<!-- claimSpans removed; inline citations in final Markdown remain the display mechanism -->

Types live in `lib/streaming-types.ts`. Backend emitters are in `app/api/chat/lib/traceLogger.ts`.

## Backend flow (how events are produced)

1) `app/api/chat/route.ts` wraps the model stream with `createUIMessageStream` and injects a writer into `TraceLogger`.
2) Tools execute with that logger in AsyncLocalStorage.
3) `researchOrchestrator.ts` emits progress at phase boundaries and performs hierarchical final synthesis when needed:
   - Searching → emits `details.summary` (queries→hits→unique) + sample domains from Exa results.
   - Deduplicating → emits samples of unique URLs/domains.
   - Analyzing is narrated via `details.subphase` + `details.metrics`:
     - Retrieval (`fetched`), SQA (`highSignal`), Analysis (`analyzed`).
   - Consolidating → `consolidated` metrics + samples.
   - Final Synthesis (map–reduce when many docs):
     - If consolidated docs < 10 → single Final Synthesis call.
     - If exactly 10 → one group; reducer is skipped.
     - If > 10 → partition into balanced groups of ≤10; run all group syntheses in parallel, then a small reducer merges the group reports into a single final document.
     - Progress signals include an operation for group synthesis and a merge step when applicable; reducer emits once.
4) `TraceLogger.emitPhaseProgress()` writes UI events directly into the stream. Raw traces remain private.
5) Large sets stream via `emitCollectionUpdate(id, { kind, action, total?, items })`.
6) Curated sources for the Sources tab stream via `emitSources(objectiveId, { items })`. The frontend displays an “All research sources” drawer (favicon + `[Title](URL)`), distinct from inline citations in the answer.

Key files:
- `app/api/chat/tools/researchOrchestratorTool/researchOrchestrator.ts`
- `app/api/chat/lib/traceLogger.ts` (emission helpers)
- `app/api/chat/route.ts` (stream wrapper + DI)
- `app/api/chat/tools/researchOrchestratorTool/finalSynthesis/agent.ts` (group synthesis via generateText)
- `app/api/chat/tools/researchOrchestratorTool/finalSynthesisReducer/agent.ts` (merge/reducer via generateText)

### Token & cost visibility (console)

- The backend prints one concise line per run (no per-step token logs):
  - `Thread <id>: <cumulative tokens> | <cached now> (<% now>) | run $<cost> (saved $<run> <run%>) | thread $<total> (saved $<total> <total%>)`.
- Thread id comes from the request `id` sent by `useChat()`; the backend aggregates cumulative thread totals and shows the current run’s cached context snapshot.
- Cached token counts prefer Anthropic provider metadata (`cache_read_input_tokens`, `cache_creation_input_tokens`); fallback to `cachedInputTokens` only if metadata is unavailable, avoiding double counting.

## Transport (what actually streams)

The server writes typed data objects into the same SSE stream as model output. Each object has:
- `type`: e.g., `data-research-phase`
- `id` (when applicable): used for reconciliation in the client state
- `data`: typed payload matching `lib/streaming-types.ts`

This enables low-latency, incremental UI updates without extra HTTP calls.

## Frontend flow (how events render)

1) `useChat()` (`app/chat/thread-chat.tsx`) receives events in `onData` and updates a `ResearchState` store (session/objectives/phases/collections/sources).
2) `components/research-progress.tsx` renders a Task‑based UI:
   - Pipeline (default): Objective step (full objective + chips for key entities/focus areas/categories), Query‑generation query chips with "Show all" (opens Details), Searching summary chips (queries|hits|unique) and sample domains.
   - Details (on demand): `ObjectiveDetails` full timeline; long lists virtualized; full objective context and full query list are shown.
3) `MessageRenderer` renders assistant `Response`/`Reasoning` using markdown. Inline citations in the answer are the model’s own `[Title](URL)` links; no hover-card overlay is used.
4) `ToolStatus` renders lightweight, transient feedback:
   - For `data-tool-status` events from think/memory tools.
   - As a fallback planning indicator when streaming but no tool/session/extraction/operation is active. It defers showing by ~200 ms to avoid flashes and uses subtle slide/fade transitions (spinner or 3‑dot variant).

## Design invariants

- Clean hierarchy: one focal line per card (title → percent), secondary info as chips/pills.
- Motion as feedback: subtle shimmer on bars; small transitions; respects reduced motion.
- Dark/light parity: neutral tokens; gradient accents; tabular numerals for stability.
- Avoid stale gaps: never leave the UI idle during active planning or in-between tool calls.

## Extending the system safely

- Adding a new phase detail:
  1. Extend `ResearchPhaseData.details` (types).
  2. Emit the new field(s) from `researchOrchestrator.ts` at the right boundary.
  3. Render in `ObjectiveDetails` behind progressive disclosure.

- Adding a new tool:
  - Define a minimal, Zod-typed contract.
  - Emit small, decision-relevant details through `TraceLogger`.
  - Keep counts/samples tiny; never stream long raw content.

- Streaming large lists:
  - Use `emitCollectionUpdate(id, { kind, action })` with `replace` for snapshots and `append` for batches of ~10 items.
  - Keep per-update cadence ≈250–400ms to avoid churn; cap lists (e.g., search_hits ≤50) unless explicitly expanded.
  - Keep Objective context stable by including it in all `data-research-objective` updates.

## Gotchas

- Don’t persist partial streams; we snapshot only after `status==='ready'`.
- Keep samples small (≤8) to protect bandwidth and UI clarity.
- Title availability varies by phase; graceful fallback to domains.
- Links in user bubbles: apply bubble‑aware link styles so URLs remain visible in both themes.

## Glossary

- Summary: tiny numeric snapshot (queries, hits, unique).
- Samples: short list of domain/URL chips for credibility.
- Phase: coarse step in the pipeline (query-generation, searching, deduplicating, analyzing, consolidating, synthesizing).



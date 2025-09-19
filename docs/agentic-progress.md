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
- `data-research-objective`: per-objective status and phase.
- `data-research-phase`: per-phase progress with optional details.
  - `details.summary` (optional): compact counts like `{ queries, hits, unique }`.
  - `details.samples` (optional): a few domains/URLs `{ url, domain?, title? }[]` for credibility without flooding.
  - `details.queries` (optional): representative query strings for UI chips (≤6).
  - `details.subphase` (optional): `'retrieval' | 'sqa' | 'analysis' | 'consolidation'` to narrate analyzing sub-steps.
  - `details.metrics` (optional): fine-grained counters
    - `fetched { ok, total }`, `highSignal { ok, total }`, `analyzed { current, total }`, `consolidated { current, total }`.
- Transient helpers: `data-research-operation`, `data-search-progress`, `data-research-error`.

Collections and curated sources:
- `data-research-collection` (persistent list updates): `{ id, kind, action, total?, items[] }`
  - `kind`: `search_hits | unique_urls | retrieved | high_signal | analyzed | consolidated | citations`.
  - `action`: `replace | append` for streaming in chunks.
- `data-research-sources` (curated list for Sources tab): `{ objectiveId?, items[] }`.

Types live in `lib/streaming-types.ts`. Backend emitters are in `app/api/chat/lib/traceLogger.ts`.

## Backend flow (how events are produced)

1) `app/api/chat/route.ts` wraps the model stream with `createUIMessageStream` and injects a writer into `TraceLogger`.
2) Tools execute with that logger in AsyncLocalStorage.
3) `researchOrchestrator.ts` emits progress at phase boundaries:
   - Searching → emits `details.summary` (queries→hits→unique) + sample domains from Exa results.
   - Deduplicating → emits samples of unique URLs/domains.
   - Analyzing is narrated via `details.subphase` + `details.metrics`:
     - Retrieval (`fetched`), SQA (`highSignal`), Analysis (`analyzed`).
   - Consolidating → `consolidated` metrics + samples.
4) `TraceLogger.emitPhaseProgress()` writes UI events directly into the stream. Raw traces remain private.
5) Large sets stream via `emitCollectionUpdate(id, { kind, action, total?, items })`.
6) Curated sources for the Sources tab stream via `emitSources(objectiveId, { items })`.

Key files:
- `app/api/chat/tools/researchOrchestratorTool/researchOrchestrator.ts`
- `app/api/chat/lib/traceLogger.ts` (emission helpers)
- `app/api/chat/route.ts` (stream wrapper + DI)

## Transport (what actually streams)

The server writes typed data objects into the same SSE stream as model output. Each object has:
- `type`: e.g., `data-research-phase`
- `id` (when applicable): used for reconciliation in the client state
- `data`: typed payload matching `lib/streaming-types.ts`

This enables low-latency, incremental UI updates without extra HTTP calls.

## Frontend flow (how events render)

1) `useChat()` (`app/chat/thread-chat.tsx`) receives events in `onData` and updates a `ResearchState` store.
2) `components/research-progress.tsx` reads that state and renders:
   - Header: percent pill + overall bar.
   - Objective card: modern shell; expanded details by default.
   - Details (`components/research-objective-details.tsx`):
     - Phase timeline with progress bars and durations.
     - Searching: summary chip + query chips (≤6).
     - Subphase metric chips (Fetched, High-signal, Analyzed, Consolidated).
     - Domain pills with favicons (samples), plus an expandable, virtualized list (256px viewport) for full collections.
     - Auto-scroll to the active phase.
3) Progressive disclosure: counts and a few samples are always visible; full lists are gated behind user intent.

## Design invariants

- Clean hierarchy: one focal line per card (title → percent), secondary info as chips/pills.
- Motion as feedback: subtle shimmer on bars; small transitions; respects reduced motion.
- Dark/light parity: neutral tokens; gradient accents; tabular numerals for stability.

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

## Gotchas

- Don’t persist partial streams; we snapshot only after `status==='ready'`.
- Keep samples small (≤8) to protect bandwidth and UI clarity.
- Title availability varies by phase; graceful fallback to domains.

## Glossary

- Summary: tiny numeric snapshot (queries, hits, unique).
- Samples: short list of domain/URL chips for credibility.
- Phase: coarse step in the pipeline (query-generation, searching, deduplicating, analyzing, consolidating, synthesizing).



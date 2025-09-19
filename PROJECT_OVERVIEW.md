# Project Overview (First Principles)

## What this system is
A real‑time, multimodal AI reasoning application. Inputs (text, images, voice→text) flow into an agent that can call tools; outputs stream back as typed parts (text, reasoning, files). The unit of UI is a streaming “message part,” not a monolithic message.

## Core invariants
- Everything streams: provider → state machine → UI.
- Visible reasoning: when supported, thinking is streamed separately from answer text.
- **Progressive research visibility**: long-running research operations stream real-time progress updates via typed data parts.
- Deterministic tools: tool interfaces are schema‑validated and side‑effects are explicit.
- Private tool outputs: tools inform decisions; the user sees only what's decision‑relevant (text/citations), not tool traces.
- Monotone persistence: only finalized exchanges are stored client‑side; partial streams aren't.
- Three‑tier caching: tool schemas, system prompts, and conversation history are cached at provider level for 60‑80% cost reduction and 2‑3x speed improvement.

## Layered architecture
- Engine (AI SDK v5): unifies providers, tool calling, and streaming; supports agentic controls (e.g., bounded steps).
- State/UI (AI SDK UI + React): `useChat()` orchestrates streaming state; AI Elements render typed parts (text, reasoning, files) and keep UX streaming‑safe.
- **Streaming infrastructure**: `createUIMessageStream` wrapper enables real-time progress updates; AsyncLocalStorage maintains context through tool execution.
- Tools: domain actions invoked by the agent; inputs/outputs are Zod‑typed; logging captured per request; **progress emissions via TraceLogger's stream writer**. Phase updates can include compact UI metadata via `emitPhaseProgress(details)`, such as `details.summary` (queries → hits → unique) and `details.samples` (small sets of domains/URLs).

## Agentic principles
- Two‑world contract: stochastic planner, deterministic tools.
- Context is scarce; storage is cheap: push heavy lifting into tools; return only decision‑relevant bits.
- Tokens are compute: spend where they increase expected value; compress elsewhere.
- Affordances shape cognition: clear names, non‑overlapping scopes, and minimal, high‑impact tools.
- Multiple valid paths: evaluate outcomes over step trace; tolerate diverse successful strategies.
- Parallelism is capability: spawn independent objectives; cap sequential loops.
- Prompts are part of the program: system and tool descriptions steer behavior; keep them concise and policy‑focused.
- State and errors compound: design for resumability, idempotency, and instructive error surfaces.

## Caching architecture
- Provider‑level prompt caching (Anthropic): caches static context at 90% cost discount and 2‑3x speed improvement.
- Three‑tier strategy: tools (1h TTL) → system prompts (1h TTL for stable, fresh for dynamic) → conversation history (5m TTL).
- Tool order determinism: consistent schema ordering with cache breakpoint on final tool to cache entire toolset.
- System prompt split: stable instructions cached across sessions; only date/context marked fresh.
- History breakpoints: dynamic cache markers on conversation state, maintained across multi‑step agent loops.
- Real‑time cost tracking: USD calculations using actual provider pricing, session‑level accumulation.

## Data flow (high level)
1) User composes input (optionally with attachments or voice).
2) Frontend sends to `/api/chat`; backend streams response parts (text/reasoning) and may call tools.
3) **Real-time research progress** streams via data parts - objectives, phases, and operations visible during long-running research; select phases include summary counts and sample source domains for richer yet uncluttered UI.
4) React UI renders parts as they arrive; editing and branching are guarded during streaming.
5) On completion, a snapshot is persisted locally; users can edit/branch subsequent interactions.

## Tooling at a glance
- **Think**: private reflection to plan next steps and verify policies; **streams status messages during reflection**.
- **Research memory**: optional per‑session notes aggregation (in‑memory by default); **streams recording status**.
- **Targeted extraction**: depth on specific URLs with controlled crawl (separate from discovery); **streams per-URL progress**.
- **Research orchestrator**: breadth→filter→depth→distill→synthesize pipeline for focused objectives; **streams multi-objective progress with phase visibility**.

## Observability principles
- Per‑request tracing with sectioned, step‑indexed logs.
- Phase summaries include duration and compact stats.
- Never log raw long content; sample sparsely; prefer counts and sizes.
- Real‑time cache performance metrics: efficiency percentages, cost savings in USD, session‑level accumulation.
- Token economics visibility: fresh vs cached token breakdown, conversation context tracking, provider pricing integration.

## UX principles
- Lead with the direct answer; support with minimal citations.
- Reasoning is visible but not copied by default.
- **Tool operations are transparent**: all tools stream real-time progress, no silent waiting. UI uses progressive disclosure: show summary chips and a few sample domains first; full lists remain gated.
- **Continuous feedback**: transition detection fills gaps between phases, ensuring visual continuity.
- Editing is safe and predictable; only one edit at a time; guard during streaming.
- Multimodal is first‑class: images and transcribed voice flow through the same pipeline.

## What to change without breaking posture
- Swap models/providers: the engine abstracts provider specifics.
- Add a tool: define a clear, typed contract; keep outputs small and decision‑oriented.
- Adjust policy: refine prompts to guide behavior, not to micromanage.

For concrete file‑level details, see:
- `app/api/chat/directory-structure.md` (backend)
- `app/chat/directory-structure.md` (frontend)

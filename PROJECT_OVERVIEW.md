# Project Overview (First Principles)

## What this system is
A bioenergetic health research system that traces symptoms to root causes through energy metabolism, gut health, and stress cascades. Built on a cognitive architecture for knowledge work, it transforms infinite health information into relevant understanding through the lens of bioenergetic principles. The system doesn't try to be omniscient—it reveals fundamental health truths. Inputs flow through specialized cognitive tools; outputs emerge as streaming bioenergetic insights.

## The fundamental insight
In health research, the scarce resource isn't data or even intelligence—it's **understanding the cascades from root causes to symptoms**. This system solves the information-to-understanding gap by viewing all health phenomena through the bioenergetic framework—energy disruption as the fundamental driver of disease.

## Bioenergetic foundation
The system operates with **calm conviction** in a foundational framework:
- **Three pillars**: Gut health, stress resilience, thyroid/energy production
- **Hierarchical cascade**: Root causes → Energy metabolism → Consequences → Manifestations
- **Universal principle**: All health issues trace back to energy disruption
- **Research philosophy**: Not testing whether the framework applies, but discovering HOW it manifests

Every component—from primary agent to sub-agents—thinks through this lens with serene certainty.

## Core invariants
- Everything streams: provider → state machine → UI.
- Visible reasoning: when supported, thinking is streamed separately from answer text.
- **Progressive research visibility**: long-running research operations stream real-time progress updates via typed data parts.
- Deterministic tools: tool interfaces are schema‑validated and side‑effects are explicit.
- Private tool outputs: tools inform decisions; the user sees only what's decision‑relevant (text/citations), not tool traces.
- Monotone persistence: only finalized exchanges are stored client‑side; partial streams aren't.
- Three‑tier caching: tool schemas, system prompts, and conversation history are cached at provider level for 60‑80% cost reduction and 2‑3x speed improvement.
- **No silent waiting**: brief, transient tool status and planning indicators provide micro‑feedback during in‑between steps.

## Layered architecture
- Engine (AI SDK v5): unifies providers, tool calling, and streaming; supports agentic controls (e.g., bounded steps).
- State/UI (AI SDK UI + React): `useChat()` orchestrates streaming state; AI Elements render typed parts (text, reasoning, files) and keep UX streaming‑safe. Research UI is Task‑based (pipeline by default, details on demand).
- **Streaming infrastructure**: `createUIMessageStream` wrapper enables real-time progress updates; AsyncLocalStorage maintains context through tool execution.
- Tools: domain actions invoked by the agent; inputs/outputs are Zod‑typed; logging captured per request; **progress emissions via TraceLogger's stream writer**. Phase updates can include compact UI metadata via `emitPhaseProgress(details)` – `summary` (queries→hits→unique), `samples` (small sets of domains/URLs), `queries` (chips), `subphase` and `metrics` for analyzing/consolidating. Large sets stream with `emitCollectionUpdate`; curated sources stream via `emitSources`. Inline citations in the final answer are rendered from the model's own markdown links.
- **Tool status UI**: transient `data-tool-status` events render as a lightweight `ToolStatus` card (think/memory tools). A fallback planning indicator appears when streaming with no other active progress (200 ms deferred show, slide/fade transitions).

## Agentic principles
- Two‑world contract: stochastic planner, deterministic tools.
- Context is scarce; storage is cheap: push heavy lifting into tools; return only decision‑relevant bits.
- Tokens are compute: spend where they increase expected value; compress elsewhere.
- Affordances shape cognition: clear names, non‑overlapping scopes, and minimal, high‑impact tools.
- Multiple valid paths: evaluate outcomes over step trace; tolerate diverse successful strategies.
- Parallelism is capability: spawn independent objectives; cap sequential loops.
- Prompts are part of the program: system and tool descriptions steer behavior; keep them concise and policy‑focused.
- State and errors compound: design for resumability, idempotency, and instructive error surfaces.

## Cognitive architecture philosophy
- **Context scarcity as intelligence driver**: Limited context isn't a bug—it's the forcing function that creates strategic thinking. Like human working memory constraints drive abstract reasoning, context limits force the system to develop judgment, strategy, and prioritization.
- **Hierarchical attention management**: Each layer attends to patterns at its appropriate scale:
  - Tools attend to documents
  - Agents attend to findings
  - Orchestrator attends to strategy
  - System attends to goals
- **Extended cognition**: Tools aren't utilities but cognitive prostheses. Each extends a specific mental capacity:
  - executeResearchPlan: Broad attention and pattern detection
  - targetedExtraction: Focused attention and deep analysis
  - thinkTool: Metacognition and reflection
  - researchMemory: Working memory expansion
- **Information-theoretic pipeline**: Progressive reduction implements lossy compression with semantic preservation. Each stage recompresses information at higher abstraction levels—raw text→facts→findings→insights→understanding. This is Shannon's theory applied to meaning.
- **Emergent problem-solving**: The system solves problems no component could solve alone. Intelligence emerges from interaction patterns, not individual capabilities. The whole genuinely exceeds the sum of parts.
- **Cognitive diversity through parallelism**: Parallel research objectives avoid path dependence and confirmation bias. Like parallel constraint satisfaction in cognitive science, multiple interpretations compete until coherence emerges.

## The virtuous cycle
Better context preservation → More strategic thinking → Better research decomposition → More efficient tool use → Better context preservation. This creates compound improvements where each optimization amplifies others.

## Deliberate design omissions (anti-features)
- **No confidence scores**: Binary decisions avoid false precision. Relevance is threshold-based, not gradient.
- **No complex metrics**: Simplicity preserves clarity and maintainability.
- **No cross-objective state**: Independence enables true parallelism without race conditions.
- **No automatic consolidation**: Preserves human judgment at synthesis points.
- **No prescriptive prompts**: Minimal instructions respect model intelligence.

These aren't missing features—they're philosophical commitments to simplicity and determinism. What's NOT in the code is as important as what is.

## Caching architecture
- Provider‑level prompt caching (Anthropic): caches static context at 90% cost discount and 2‑3x speed improvement.
- Three‑tier strategy: tools (5m TTL) → system prompts (5m TTL for stable, fresh for dynamic) → conversation history (5m TTL).
- **5-minute sliding window**: With messages every 1-2 minutes, caches refresh FREE when accessed within 5m, creating a perpetually warm cache that follows the conversation.
- **37.5% cost reduction**: 5m TTL costs 1.25x base (vs 2x for 1h), while maintaining 0.1x read costs through the free refresh mechanism.
- Tool order determinism: consistent schema ordering with cache breakpoint on final tool to cache entire toolset.
- System prompt split: stable instructions cached with 5m TTL; only date/context marked fresh.
- History breakpoints: dynamic cache markers on conversation state, maintained across multi‑step agent loops.
- Real‑time cost tracking: USD calculations using actual provider pricing, session‑level accumulation.
- Thread‑aware accounting: backend aggregates tokens per thread (using the incoming request `id` as threadId) and also reports per‑run metrics.
- Cache correctness: cached token counts prefer provider metadata (`cache_read_input_tokens` + `cache_creation_input_tokens`) with fallback to `cachedInputTokens` only when metadata is absent, avoiding double‑counting.

## Data flow (high level)
1) User composes input (optionally with attachments or voice).
2) Frontend sends to `/api/chat`; backend streams response parts (text/reasoning) and may call tools.
3) **Real-time research progress** streams via data parts - objectives, phases, subphase metrics and collections. Pipeline includes a leading Objective step (full objective + chips for key entities, focus areas, categories). Query‑generation shows representative query chips; Searching shows summary chips (queries→hits→unique) and sample domains. Large lists stream in chunks; curated sources power the Sources drawer. Inline citations are rendered directly from markdown links.
4) React UI renders parts as they arrive; editing and branching are guarded during streaming.
5) On completion, a snapshot is persisted locally; users can edit/branch subsequent interactions.

## Tooling philosophy
Tools implement the extended mind thesis—they're not just utilities but extensions of cognitive capabilities:

- **Think**: Private metacognition space for planning and reflection; streams status during deep thinking.
- **Research memory**: Working memory expansion for cumulative understanding across cycles; streams recording status.
- **Targeted extraction**: Surgical focused attention for depth on specific sources; streams per-URL progress.
- **Research orchestrator**: Broad attention implementing breadth→filter→depth→distill→synthesize pipeline; streams multi-objective progress with phase visibility.

Each tool solves a specific cognitive limitation while preserving the primary agent's strategic oversight.

## Observability principles
- Per‑request tracing with sectioned, step‑indexed logs.
- Phase summaries include duration and compact stats.
- Never log raw long content; sample sparsely; prefer counts and sizes.
- Real‑time cache performance metrics: efficiency percentages, cost savings in USD, session‑level and thread‑level accumulation.
- Token economics visibility: concise console summary per run:
  - `Thread <id>: <cumulative tokens> | <cached now> (<% now>) | run $<cost> (saved $<run> <run%>) | thread $<total> (saved $<total> <total%>)`.
- No per‑step token prints in console; only the single concise thread line.

## UX principles
- Lead with the direct answer; support with minimal citations.
- Reasoning is visible but not copied by default.
- **Tool operations are transparent**: all tools stream real-time progress, no silent waiting. UI uses progressive disclosure: Task pipeline by default; per‑objective "Details" view on demand; summary chips first; long lists gated and virtualized. Multiple objectives can be expanded simultaneously.
- **Continuous feedback**: inline loaders within the active Task (no floating overlays).
- Editing is safe and predictable; only one edit at a time; guard during streaming.
- Multimodal is first‑class: images and transcribed voice flow through the same pipeline.
- **Usability polish**: user-bubble link visibility is guaranteed (bubble‑aware link styles); micro‑feedback during planning avoids stale states.

## What to change without breaking posture
- Swap models/providers: the engine abstracts provider specifics.
- Add a tool: define a clear, typed contract; keep outputs small and decision‑oriented.
- Adjust policy: refine prompts to guide behavior, not to micromanage.
- Inline citations: render the model's markdown links; no backend claim‑span offsets.

## The deeper pattern
This system implements what biological intelligence discovered through evolution: hierarchical processing with specialized subsystems, scarce working memory driving abstraction, and parallel exploration maintaining cognitive diversity. It's not mimicking human thought—it's implementing the deeper principles that make thought possible.

For concrete file‑level details, see:
- `app/api/chat/directory-structure.md` (backend)
- `app/chat/directory-structure.md` (frontend)
- `docs/PHILOSOPHY.md` (deeper architectural principles)
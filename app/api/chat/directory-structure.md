# app/api/chat/directory-structure.md

app/api/chat/
│
├── route.ts                    # Main API route (POST) - CLEAN ORCHESTRATION
│                               # - Initializes services (Logger, CacheManager, TokenEconomics)
│                               # - Prepares cached components via CacheManager
│                               # - Creates stream callbacks via dependency injection
│                               # - **Wraps streamText with createUIMessageStream for progress streaming**
│                               # - **Injects stream writer into TraceLogger for tool progress emissions**
│                               # - Configures streamText with tools and Anthropic options
│                               # - Receives `{ id, messages }`; uses `id` as threadId for per-thread accounting
│                               # - Returns createUIMessageStreamResponse({ stream })
│
├── systemPrompt.ts             # Primary agent instructions (concise, non-prescriptive)
│                               # - Iterative/parallel research guidance
│                               # - Decision/stop criteria, source quality heuristics
│                               # - Response style and citation expectations
│                               # - Split architecture: stable instructions (cached 1h) + dynamic context (fresh)
│
├── lib/
│   ├── cacheManager.ts         # Three-tier Anthropic caching orchestration
│   │                           # - Tool schema caching with 1h TTL
│   │                           # - System prompt split (stable cached/dynamic fresh)
│   │                           # - Conversation history caching with 5m TTL
│   │                           # - Cache breakpoint management for multi-step loops
│   ├── tokenEconomics.ts       # Session/thread token tracking and cost analysis
│   │                           # - Singleton pattern for session persistence
│   │                           # - Real-time USD cost calculations with cache discounts
│   │                           # - Cache efficiency metrics (multiplier, true efficiency)
│   │                           # - Provider metadata preferred for cache counts; fallback to usage only if needed
│   │                           # - Console output: single concise line per run (thread totals + this-run cost)
│   ├── streamCallbacks.ts      # Stream event handlers with dependency injection
│   │                           # - onFinish: cache metrics and final response (per-thread + per-run)
│   │                           # - onError/onAbort: proper log finalization
│   │                           # - prepareStep: cache breakpoint maintenance
│   ├── traceLogger.ts          # Structured per-request tracing (AsyncLocalStorage)
│   │                           # - Sectioned logs with step-indexed events
│   │                           # - Phase summaries + timing metrics per pipeline stage
│   │                           # - **Stream writer injection for real-time progress emissions**
│   │                           # - **Comprehensive emission methods:**
│   │                           #   • Research: emitSessionProgress, emitObjectiveProgress, emitPhaseProgress
│   │                           #   • Extraction: emitExtractionSession, emitExtractionUrl
│   │                           #   • Tools: emitToolStatus for think/memory tools
│   │                           #   • Operations: emitOperation, emitSearchProgress, emitError
│   │                           #   • Collections: emitCollectionUpdate(id, { kind, action, total?, items })
│   │                           #   • Sources: emitSources(objectiveId?, { items }) for curated Sources tab
│   │                           # - emitPhaseProgress supports details.summary (queries→hits→unique), details.samples (domains/URLs),
│   │                           #   details.queries (query chips), details.subphase, details.metrics (fetched/highSignal/analyzed/consolidated)
│   │                           # - Aggregated retry metrics per phase
│   │                           # - Writes section files + overview file in /logs
│   ├── llmRetry.ts             # Timeout + retry wrapper for LLM calls
│   │                           # - Per-phase timeouts with AbortSignal cancellation
│   │                           # - Exponential backoff with jitter; respects Retry-After
│   │                           # - Error classification (retryable vs non-retryable)
│   └── retryConfig.ts          # Environment-driven retry/timeout configuration
│                               # - Per-phase timeout defaults with env overrides
│                               # - Max attempts and backoff settings
│
└── tools/                      # Tools callable by the primary agent
    │
    ├── executeResearchPlanTool/
    │   └── executeResearchPlanTool.ts  # Entry tool for executing research plans
    │                                    # - Accepts an array of research objectives
    │                                    # - **Emits session-level progress (starting/active/complete)**
    │                                    # - **Emits individual objective progress updates**
    │                                    # - Runs each objective in parallel (Promise.allSettled)
    │                                    # - Calls researchOrchestrator per objective
    │                                    # - Merges per-objective Markdown reports (lists failures)
    │
    ├── thinkTool/
    │   └── think-tool.ts        # Private reasoning/scratchpad tool (side-effect-free)
    │                            # - **Emits transient status during thinking**
    │
    ├── researchMemoryTool/
    │   └── researchMemoryTool.ts # In-memory per-instance notes (durable only if later backed)
    │                             # - **Emits transient status when recording notes**
    │
    ├── targetedExtractionTool/   # Targeted depth on specific URLs (separate from discovery)
    │   ├── targetedExtractionTool.ts # **Emits extraction session and per-URL progress**
    │   ├── types.ts
    │   ├── constants.ts
    │   ├── retrieval/
    │   │   └── executor.ts       # Exa content retrieval with optional live crawl/subpages
    │   │                         # - **Emits retrieval progress per URL**
    │   └── extraction/
    │       ├── agent.ts          # Gemini structured extraction
    │       │                     # - **Emits extraction progress per URL**
    │       ├── prompt.ts
    │       ├── schema.ts
    │       └── types.ts
    │
    └── researchOrchestratorTool/ # Core pipeline for a single research objective
        ├── researchOrchestrator.ts  # Orchestrates end-to-end:
        │                            #   Query gen → Exa search → canonicalized dedup →
        │                            #   Exa full-text (batched, rate-limited) → SQA (full text) →
        │                            #   Content analysis → Consolidation → Final synthesis
        │                            # - **Emits phase progress updates at boundaries**
        │                            # - Emits sample domains/URLs + search summary counts for UI
        │                            # - Emits full query list on query-generation for UI chips/Details
        │                            # - Emits subphase + metric details during analyzing/consolidating
        │                            # - Streams large sets via emitCollectionUpdate (search_hits, unique_urls, retrieved, high_signal, analyzed, consolidated)
        │                            # - Seeds curated sources via emitSources and finalizes post-synthesis
        │                            # - Re-emits objective context (focusAreas, keyEntities, categories) with each phase via emitObjectiveProgress
        │                            # - **Emits operation messages for user feedback**
        │                            # - Phase summaries with duration_ms + compact stats
        │                            # - Deterministic errors + partial successes
        │
        ├── constants.ts            # Shared constants (e.g., EXA_CATEGORIES)
        │
        ├── exaSearch/              # Exa API wrappers and orchestration
        │   ├── executor.ts         # Orchestrates Exa search per objective (concurrency chunks)
        │   ├── exaClient.ts        # Exa SDK wrappers: searchExa(), getContents(); 80ms rate limiter
        │   ├── types.ts            # ExaSearchConfig/Hit/Outcome types
        │   └── constants.ts        # defaultExaSearchOptions, concurrency constants
        │
        ├── researchStrategy/
        │   └── schema.ts           # ResearchPlan schema (focusedObjective, focusAreas, etc.)
        │
        ├── queryGeneration/
        │   ├── agent.ts            # Anthropic (Claude) → keyword + neural queries
        │   ├── prompt.ts           # Query strategy guidance
        │   ├── schema.ts           # QueryGenerationOutput schema
        │   └── types.ts
        │
        ├── signalQualityAssessment/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → relevance on full text
        │   ├── prompt.ts           # Assessment policy (concise rationale)
        │   ├── schema.ts           # isHighSignal + rationale
        │   └── types.ts            # SQAInput (with fullText) / SQAOutput
        │
        ├── contentAnalysis/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → findings + evidence + summary
        │   ├── constants.ts        # Concurrency limits and batch delays
        │   ├── prompt.ts           # Analysis policy (evidence discipline; concision)
        │   ├── schema.ts           # Structured analysis output schema
        │   └── types.ts
        │
        ├── researchConsolidation/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → essential contributions
        │   ├── prompt.ts           # Consolidation policy (primary contribution; minimal findings)
        │   ├── schema.ts           # Consolidated document schema
        │   └── types.ts
        │
        └── finalSynthesis/
            ├── agent.ts            # Anthropic (Claude) → final Markdown report (generateText)
            ├── prompt.ts           # Synthesis policy; output format; disciplined citations (inline [Title](URL))
            └── types.ts            # FinalSynthesisAgentInput / FinalSynthesisAgentOutput (finalDocument only)

---

## Execution flow (high level)
1) Client → POST /api/chat/route.ts (UIMessage parts) → createUIMessageStream wrapper → streamText
2) Route applies three-tier caching: tools (cached 1h) + system (stable cached, dynamic fresh) + conversation history (cached 5m)
3) **Stream writer injected into TraceLogger via AsyncLocalStorage context**
4) Primary agent plans tool usage; tools run with per-request TraceLogger context; cache performance tracked in real-time
5) **Tools emit real-time progress via logger's stream writer → data parts stream to frontend**
6) executeResearchPlanTool runs objectives in parallel → researchOrchestrator per objective
7) **Each research phase emits progress updates (query-gen, searching, analyzing, etc.)**, including optional details.summary (queries→hits→unique) and details.samples (domains/URLs) for UI richness
8) Orchestrator phases log summaries (duration_ms, counts) and provide small sample URLs for visibility
9) Final synthesis returns Markdown report → route streams to client (reasoning included) + cache metrics (USD costs, efficiency)
10) **Frontend onData callback updates ResearchState → ResearchProgress component renders**

Notes:
- All LLM phases wrapped with timeout + retry (withRetry): per-phase timeouts, exponential backoff, error classification.
- Retry metrics aggregated per phase and logged in console summaries and trace files.
- Three-tier Anthropic prompt caching delivers 60-80% cost reduction and 2-3x speed improvement with cache hit rates.
- Cache performance tracked in real-time: efficiency percentages, USD cost calculations, session-level accumulation.
- System prompt split ensures maximum cache reuse: stable instructions cached across sessions, only dynamic context marked fresh.
- Exa crawl options (livecrawl/subpages) are handled by targetedExtractionTool, not the orchestrator pipeline.
- URL canonicalization is applied before dedup and for final citations; original URLs are used for fetching.
- Rate limiting for Exa is ~12.5 QPS (80 ms queue); batching is used across phases for throughput.

# app/api/chat/directory-structure.md

app/api/chat/
│
├── route.ts                    # Main API route (POST) - CLEAN ORCHESTRATION
│                               # - Initializes services (Logger, CacheManager, TokenEconomics)
│                               # - **Context limit enforcement**: Checks persistent tokens before processing; blocks at 100k (HTTP 413)
│                               # - Prepares cached components via CacheManager
│                               # - Creates stream callbacks via dependency injection (includes hasToolsRef)
│                               # - **Wraps streamText with createUIMessageStream for progress streaming**
│                               # - **Injects stream writer into TraceLogger for tool progress emissions**
│                               # - **Emits context warnings** (70k/85k/95k thresholds) at stream start
│                               # - Configures streamText with tools and Anthropic options
│                               # - Receives `{ id, messages }`; uses `id` as threadId for per-thread accounting
│                               # - Returns createUIMessageStreamResponse({ stream })
│
├── systemPrompt.ts             # Primary agent instructions (bioenergetic specialist)
│                               # - Includes full bioenergetic knowledge framework
│                               # - Operates with calm conviction in fundamental health truths
│                               # - Iterative/parallel research guidance
│                               # - Decision/stop criteria, source quality heuristics
│                               # - Response style and citation expectations
│                               # - Split architecture: stable instructions (cached 5m) + dynamic context (fresh)
│
├── data/
│   └── knowledge.md            # Bioenergetic knowledge framework (7,200 tokens)
│                               # - Three pillars: gut health, stress, thyroid/energy
│                               # - Hierarchical cascade model
│                               # - Root causes → Energy → Consequences → Manifestations
│
├── lib/
│   ├── bioenergeticKnowledge.ts # Central loader for bioenergetic framework
│   │                           # - Loads knowledge.md once at module init
│   │                           # - Exports BIOENERGETIC_KNOWLEDGE for all prompts
│   │                           # - Used universally across all agents
│   ├── cacheManager.ts         # Three-tier Anthropic caching orchestration
│   │                           # - Tool schema caching with 5m TTL (free refresh on active use)
│   │                           # - System prompt split (stable cached 5m/dynamic fresh)
│   │                           # - Conversation history caching with 5m TTL
│   │                           # - Cache breakpoint management for multi-step loops
│   │                           # - 5m sliding window: 37.5% cost reduction via free refreshes
│   ├── tokenEconomics.ts       # Session/thread token tracking and cost analysis
│   │                           # - Singleton pattern for session persistence
│   │                           # - Real-time USD cost calculations with cache discounts
│   │                           # - **Persistent context tracking**: Extracts PRIMARY AGENT tokens from anthropic.usage.input_tokens
│   │                           # - **Settled context algorithm**: Freezes persistent count during tool use, updates only when settled
│   │                           # - Context limit warnings at 70k/85k/95k; hard block at 100k tokens
│   │                           # - Console output: 4-line format with persistent tokens, cache breakdown, cost analysis
│   ├── streamCallbacks.ts      # Stream event handlers with dependency injection
│   │                           # - Tool tracking: hasToolsRef tracks whether tools executed in current request
│   │                           # - onFinish: cache metrics and final response (per-thread + per-run); passes hasTools flag
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
│   │                           #   • Context: emitContextWarning for persistent token tracking
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
    │       ├── prompt.ts         # Extraction through bioenergetic lens
    │       │                     # - Finds root causes and energy connections
    │       │                     # - Includes full bioenergetic knowledge
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
        │   ├── prompt.ts           # Query strategy with bioenergetic lens
        │   │                       # - Seeks root causes and energy connections
        │   │                       # - Includes full bioenergetic knowledge
        │   ├── schema.ts           # QueryGenerationOutput schema
        │   └── types.ts
        │
        ├── signalQualityAssessment/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → relevance on full text
        │   ├── prompt.ts           # Assessment through bioenergetic framework
        │   │                       # - Prioritizes root causes over symptoms
        │   │                       # - Includes full bioenergetic knowledge
        │   ├── schema.ts           # isHighSignal + rationale
        │   └── types.ts            # SQAInput (with fullText) / SQAOutput
        │
        ├── contentAnalysis/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → findings + evidence + summary
        │   ├── constants.ts        # Concurrency limits and batch delays
        │   ├── prompt.ts           # Analysis through energy cascade lens
        │   │                       # - Works with calm certainty
        │   │                       # - Reveals bioenergetic patterns
        │   │                       # - Includes full bioenergetic knowledge
        │   ├── schema.ts           # Structured analysis output schema
        │   └── types.ts
        │
        ├── researchConsolidation/
        │   ├── agent.ts            # Gemini 2.5 flash-lite → essential contributions
        │   ├── prompt.ts           # Consolidation with calm clarity
        │   │                       # - Identifies causal contributions
        │   │                       # - Includes full bioenergetic knowledge
        │   ├── schema.ts           # Consolidated document schema
        │   └── types.ts
        │
        ├── finalSynthesis/
        │   ├── agent.ts            # Anthropic (Claude) → final Markdown report (generateText)
        │   ├── prompt.ts           # Synthesis with calm authority
        │   │                       # - Reveals bioenergetic cascades
        │   │                       # - Includes full bioenergetic knowledge
        │   └── types.ts
        │
        └── finalSynthesisReducer/
            ├── agent.ts            # Anthropic (Claude) → merged synthesis
            ├── prompt.ts           # Merge with calm assurance
            │                       # - Recognizes convergent truths
            │                       # - Includes full bioenergetic knowledge
            └── types.ts

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
- **5-minute TTL optimization**: With high-frequency messages (every 1-2 min), the cache constantly refreshes for FREE, creating a "sliding window" that follows conversations. This achieves 37.5% write cost reduction (1.25x vs 2x) while maintaining identical read performance (0.1x).
- Cache performance tracked in real-time: efficiency percentages, USD cost calculations, session-level accumulation.
- System prompt split ensures cache reuse: stable instructions cached with 5m TTL, only dynamic context marked fresh.
- Exa crawl options (livecrawl/subpages) are handled by targetedExtractionTool, not the orchestrator pipeline.
- URL canonicalization is applied before dedup and for final citations; original URLs are used for fetching.
- Rate limiting for Exa is ~12.5 QPS (80 ms queue); batching is used across phases for throughput.

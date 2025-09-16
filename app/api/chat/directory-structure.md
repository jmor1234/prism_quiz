# app/api/chat/directory-structure.md

app/api/chat/
│
├── route.ts                    # Main API route (POST)
│                               # - Streams responses via Vercel AI SDK v5 (streamText)
│                               # - Registers tools: thinkTool, researchMemoryTool,
│                               #   targetedExtractionTool, executeResearchPlanTool
│                               # - Agentic controls: stopWhen(stepCountIs(50))
│                               # - Provider options: Anthropic thinking (visible reasoning)
│                               # - Returns toUIMessageStreamResponse({ sendReasoning: true })
│
├── systemPrompt.ts             # Primary agent instructions (concise, non-prescriptive)
│                               # - Iterative/parallel research guidance
│                               # - Decision/stop criteria, source quality heuristics
│                               # - Response style and citation expectations
│
├── lib/
│   ├── traceLogger.ts          # Structured per-request tracing (AsyncLocalStorage)
│   │                           # - Sectioned logs with step-indexed events
│   │                           # - Phase summaries + timing metrics per pipeline stage
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
    │                                    # - Runs each objective in parallel (Promise.allSettled)
    │                                    # - Calls researchOrchestrator per objective
    │                                    # - Merges per-objective Markdown reports (lists failures)
    │
    ├── thinkTool/
    │   └── think-tool.ts        # Private reasoning/scratchpad tool (side-effect-free)
    │
    ├── researchMemoryTool/
    │   └── researchMemoryTool.ts # In-memory per-instance notes (durable only if later backed)
    │
    ├── targetedExtractionTool/   # Targeted depth on specific URLs (separate from discovery)
    │   ├── targetedExtractionTool.ts
    │   ├── types.ts
    │   ├── constants.ts
    │   ├── retrieval/
    │   │   └── executor.ts       # Exa content retrieval with optional live crawl/subpages
    │   └── extraction/
    │       ├── agent.ts          # Gemini structured extraction
    │       ├── prompt.ts
    │       ├── schema.ts
    │       └── types.ts
    │
    └── researchOrchestratorTool/ # Core pipeline for a single research objective
        ├── researchOrchestrator.ts  # Orchestrates end-to-end:
        │                            #   Query gen → Exa search → canonicalized dedup →
        │                            #   Exa full-text (batched, rate-limited) → SQA (full text) →
        │                            #   Content analysis → Consolidation → Final synthesis
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
            ├── agent.ts            # Gemini 2.5 flash → outline + final Markdown report
            ├── prompt.ts           # Synthesis policy; output format; disciplined citations
            ├── schema.ts           # reportOutline + finalDocument
            └── types.ts

---

## Execution flow (high level)
1) Client → POST /api/chat/route.ts (UIMessage parts) → streamText
2) Primary agent plans tool usage; tools run with per-request TraceLogger context
3) executeResearchPlanTool runs objectives in parallel → researchOrchestrator per objective
4) Orchestrator phases log summaries (duration_ms, counts, sample URLs)
5) Final synthesis returns Markdown report → route streams to client (reasoning included)

Notes:
- All LLM phases wrapped with timeout + retry (withRetry): per-phase timeouts, exponential backoff, error classification.
- Retry metrics aggregated per phase and logged in console summaries and trace files.
- Exa crawl options (livecrawl/subpages) are handled by targetedExtractionTool, not the orchestrator pipeline.
- URL canonicalization is applied before dedup and for final citations; original URLs are used for fetching.
- Rate limiting for Exa is ~12.5 QPS (80 ms queue); batching is used across phases for throughput.

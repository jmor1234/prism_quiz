# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    ├── route.ts              # Submit endpoint: ingests submission, returns caseId
    ├── result/
    │   └── route.ts          # Result retrieval endpoint: returns cached analysis by caseId
    ├── analyze/
    │   ├── route.ts          # Three-phase streaming agent endpoint
    │   ├── systemPrompt.ts   # Builds 3-phase system prompt with context + interpretation guides
    │   └── streamCallbacks.ts # Report-specific streaming callbacks (no caching)
    ├── tools/                # Report-specific tool
    │   ├── thinkTool.ts      # Reasoning, capturing findings, and tracking across phases
    │   ├── recommendDiagnostics/
    │   │   ├── tool.ts       # Tool definition with logging
    │   │   ├── agent.ts      # Sub-agent invocation with CSV loading
    │   │   └── schema.ts     # Input/output schemas with constraints
    │   ├── recommendDietLifestyle/
    │   │   ├── tool.ts
    │   │   ├── agent.ts
    │   │   └── schema.ts
    │   └── recommendSupplements/
    │       ├── tool.ts
    │       ├── agent.ts
    │       └── schema.ts
    └── data/
        ├── questionaire.md   # Questionnaire interpretation guide (PRIMARY for Phase 1)
        ├── takehome.md       # Take-home test interpretation guide (PRIMARY for Phase 1)
        ├── Prsim Data - Diagnostics_implications.csv       # Used by recommendDiagnosticsTool
        ├── Prsim Data - Diet & Lifestyle.csv               # Used by recommendDietLifestyleTool
        └── Prsim Data - Supplements & Pharmaceuticals.csv  # Used by recommendSupplementsTool
```

## Files

### Submission Flow
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads (validates with `phase1SubmissionSchema`).
  - Persists to `storage/phase1-submissions/<caseId>.json`.
  - Returns `{ caseId }` to frontend.

### Result Retrieval
- `phase1/result/route.ts`
  - GET endpoint accepting `caseId` query parameter.
  - Retrieves existing analysis result via `getPhase1Result(caseId)`.
  - Returns `{ report, createdAt }` if found (200), or 404 if not found.
  - Used by frontend to check for cached results before initiating new analysis.

### Analysis Flow (Directive-Driven Three-Phase Pipeline)
- `phase1/analyze/route.ts`
  - Directive-driven three-phase streaming agent endpoint (POST with `{ caseId }`).
  - Loads submission from storage via `getPhase1Case(caseId)`.
  - Builds directive-driven 3-phase system prompt with `buildPhase1SystemPrompt(submission)`.
  - Runs streaming agent with 6 tools:
    - **Report-specific cognitive tool:**
      - `reportThinkTool` - extraction tracking, enrichment planning, completion verification
    - **Research tools (from chat route):**
      - `executeResearchPlanTool` - broad research (citations only)
      - `targetedExtractionTool` - focused extraction
    - **Recommendation tools (per-item enrichment):**
      - `recommendDiagnosticsTool` - CSV lookup + enrichment per directive item
      - `recommendDietLifestyleTool` - CSV lookup + enrichment per directive item
      - `recommendSupplementsTool` - CSV lookup + enrichment per directive item
  - Reuses streaming infrastructure from chat route:
    - `TraceLogger` + `asyncLocalStorage` (progress emissions)
    - `TokenEconomics` (cost tracking)
  - Uses report-specific streaming callbacks:
    - `createReportStreamCallbacks` (step handlers without caching)
  - Streams report text via custom `data-report-text` events (manually iterates `result.textStream`).
  - Executes full 3-phase workflow:
    - **Phase 1:** Extract directives from Dalton's/Advisor notes; parse questionnaire/takehome against interpretation guides
    - **Phase 2:** Map data to guide implications; enrich each directive item via per-item tool calls (8-15+); gather citations
    - **Phase 3:** Build References section; stream final report
  - Saves final comprehensive report to `storage/phase1-results/<caseId>.json`.
  - Max duration: 15 minutes.

- `phase1/analyze/systemPrompt.ts`
  - Loads interpretation guides from `data/` directory (cached after first load).
  - Builds directive-driven 3-phase system prompt:
    - Prism context (what company, what you're generating)
    - Bioenergetic knowledge framework (from `@/app/api/chat/lib/bioenergeticKnowledge`)
    - `<interpretation_guides>` (questionnaire.md + takehome.md)
    - `<client_data>` (questionnaire responses, takehome assessment, advisor notes, **Dalton's final notes**)
    - **Agent role:** Executor & Enricher (not decision-maker)
    - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
    - **Phase 1:** Extract directives from notes; parse questionnaire/takehome against guides
    - **Phase 2:** Map to guide implications; enrich directives via per-item tool calls; gather citations
    - **Phase 3:** Build References section; stream final report
  - Returns array of message objects for `streamText`.
  - **Prompt philosophy:** Intent over prescription, data clarity, enabling autonomy within bounded context

### Report-Specific Cognitive Tool
- `phase1/tools/thinkTool.ts`
  - **Description:** Tracking space for extraction results, enrichment planning, and completion verification
  - **Schema:** Single `thought` parameter for structured tracking/reasoning
  - **Pattern:** Follows Anthropic's design where thinkTool serves both reasoning and memory purposes
  - **Usage:** Agent uses for capturing parsed directives, noting ambiguities, tracking pending tool calls, verifying operations complete before proceeding

- `phase1/analyze/streamCallbacks.ts`
  - **Purpose:** Report-specific streaming event handlers without caching overhead
  - **Differences from chat:** Removed `cache` dependency, simplified `prepareStep` to return messages as-is
  - **Rationale:** Report execution is single-shot with unique client data per case - caching provides no benefit

### Recommendation Tools (Per-Item Enrichment Sub-Agents)
- `phase1/tools/recommendDiagnostics/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diagnostics_implications.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Clear goal (lookup + enrich), data definitions, decision logic (no schema overlap)

- `phase1/tools/recommendDietLifestyle/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diet & Lifestyle.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Clear goal (lookup + enrich), data definitions, decision logic

- `phase1/tools/recommendSupplements/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Supplements & Pharmaceuticals.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Clear goal (lookup + enrich), data definitions, decision logic

**Key principles:**
- **Per-item pattern:** Called once per directive item (8-15+ calls per report)
- **Discriminated unions:** Returns `type: "specific"` (single match) or `type: "options"` (2-5 matches for ambiguous requests)
- Sub-agents are blind (no research tools, no memory, only see requested item + context)
- CSV database is PRIMARY authority for each tool
- Structured output via `generateObject` ensures type safety
- Primary agent provides comprehensive context and orchestrates vague → specific flow

### Data
- `phase1/data/questionaire.md`
  - Maps questionnaire questions to bioenergetic implications.
  - PRIMARY authority for Phase 1 root cause identification.

- `phase1/data/takehome.md`
  - Maps take-home tests to interpretations.
  - PRIMARY authority for Phase 1 root cause identification.

- `phase1/data/Prsim Data - Diagnostics_implications.csv`
  - Diagnostic tests database (242 entries).
  - Used by recommendDiagnosticsTool in Phase 2.

- `phase1/data/Prsim Data - Diet & Lifestyle.csv`
  - Diet and lifestyle interventions database (138 entries).
  - Used by recommendDietLifestyleTool in Phase 2.

- `phase1/data/Prsim Data - Supplements & Pharmaceuticals.csv`
  - Supplements and pharmaceuticals database (334 entries).
  - Used by recommendSupplementsTool in Phase 2.

## Related Modules
- `server/phase1Cases.ts` – Submission persistence (`upsertPhase1Case`, `getPhase1Case`).
- `server/phase1Results.ts` – Result persistence (`savePhase1Result`, `getPhase1Result`).
- `lib/schemas/phase1.ts` – Shared Zod schema and constants for submissions.
- `app/api/report/phase1/tools/` – Report-specific cognitive tool (thinkTool).
- `app/api/report/phase1/analyze/streamCallbacks.ts` – Report-specific streaming callbacks (no caching).
- `app/api/chat/tools/` – Research tools reused (executeResearchPlanTool, targetedExtractionTool).
- `app/api/chat/lib/` – Streaming infrastructure reused (TraceLogger, TokenEconomics).
- `app/api/chat/lib/bioenergeticKnowledge.ts` – Bioenergetic framework used in all prompts.
- `docs/agentic-progress.md` – Streaming progress patterns reference.
- `docs/report_proj_overview.md` – Complete project overview and architecture principles.

## Architecture Summary

**Single-session directive-driven 3-phase pipeline:**
1. **Phase 1:** Primary agent extracts directives from Dalton's/Advisor notes → parses questionnaire/takehome data → flags items ≥2 against interpretation guides
2. **Phase 2:** Primary agent maps flagged items to guide implications → calls per-item enrichment tools (8-15+) → receives CSV-matched details (specific or options) → gathers citations
3. **Phase 3:** Primary agent builds References section → streams final report

**Key architectural principles:**
- **Directive-driven:** Human expertise (Dalton/Advisor) directs interventions; agent executes and enriches
- **Cognitive hierarchy:** Primary agent (Executor & Enricher) → Sub-agents (specialized CSV lookup + enrichment)
- **Authority hierarchy:** Dalton's notes (PRIMARY directives) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
- **Per-item enrichment:** Tools called once per directive item (not batch selection)
- **Discriminated unions:** Clear contract for specific vs ambiguous matches enabling flexible orchestration
- **Prompt philosophy:** Intent over prescription, schema defines contract, enable autonomy within bounded context
- **Streaming visibility:** Real-time progress for all operations (research, per-item tool calls, extractions)


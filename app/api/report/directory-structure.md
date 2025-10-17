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
    ├── tools/                # Report-specific tools
    │   ├── thinkTool.ts      # Reasoning for phase orchestration and quality assessment
    │   ├── researchMemoryTool.ts # Tracking findings and citations across phases
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

### Analysis Flow (Three-Phase Pipeline)
- `phase1/analyze/route.ts`
  - Three-phase streaming agent endpoint (POST with `{ caseId }`).
  - Loads submission from storage via `getPhase1Case(caseId)`.
  - Builds 3-phase system prompt with `buildPhase1SystemPrompt(submission)`.
  - Runs streaming agent with 7 tools:
    - **Report-specific cognitive tools:**
      - `reportThinkTool` - reasoning for phase orchestration and quality assessment
      - `reportResearchMemoryTool` - tracking findings and citations across phases
    - **Research tools (from chat route):**
      - `executeResearchPlanTool` - broad research
      - `targetedExtractionTool` - focused extraction
    - **Recommendation tools (report-specific):**
      - `recommendDiagnosticsTool` - CSV-based diagnostic matching
      - `recommendDietLifestyleTool` - CSV-based intervention matching
      - `recommendSupplementsTool` - CSV-based supplement matching
  - Reuses streaming infrastructure from chat route:
    - `TraceLogger` + `asyncLocalStorage` (progress emissions)
    - `TokenEconomics` (cost tracking)
  - Uses report-specific streaming callbacks:
    - `createReportStreamCallbacks` (step handlers without caching)
  - Streams report text via custom `data-report-text` events (manually iterates `result.textStream`).
  - Executes full 3-phase workflow:
    - **Phase 1:** Identify fundamental root causes (interpretation guides PRIMARY, research SECONDARY)
    - **Phase 2:** Call recommendation tools → validate with research
    - **Phase 3:** Synthesize concise client-facing report with inline citations
  - Saves final comprehensive report to `storage/phase1-results/<caseId>.json`.
  - Max duration: 15 minutes.

- `phase1/analyze/systemPrompt.ts`
  - Loads interpretation guides from `data/` directory (cached after first load).
  - Builds 3-phase system prompt:
    - Prism context (what company, what you're generating)
    - Bioenergetic knowledge framework (from `@/app/api/chat/lib/bioenergeticKnowledge`)
    - `<interpretation_guides>` (questionnaire.md + takehome.md)
    - `<client_data>` (questionnaire responses, takehome assessment, advisor notes)
    - **Phase 1:** Root cause identification with authority hierarchy
    - **Phase 2:** Recommendation generation via tools
    - **Phase 3:** Client-facing synthesis (concise, interconnected, evidence-based, actionable)
  - Returns array of message objects for `streamText`.
  - **Prompt philosophy:** Intent over prescription, data clarity, enabling autonomy

### Report-Specific Cognitive Tools
- `phase1/tools/thinkTool.ts`
  - **Description:** Reasoning space for phase orchestration, quality assessment, and execution decisions within structured workflow
  - **Schema:** Single `thought` parameter for structured reasoning about phase transitions, evidence sufficiency, or next actions
  - **Context:** Recontextualized from chat's open-ended research strategy to report's single-session phase execution
  - **Usage:** Agent uses for evaluating when phases are complete, assessing evidence quality, planning next steps

- `phase1/tools/researchMemoryTool.ts`
  - **Description:** Track findings, evidence, and connections across phases within single-session analysis
  - **Schema:** Single `note` parameter for analysis notes - key findings, evidence discovered, phase connections, synthesis observations
  - **Citation preservation:** Schema explicitly guides agent to include exact citations `[Title](URL)` for evidence preservation
  - **Returns:** `currentMemory` with all accumulated notes for retrieval in later phases
  - **Context:** Recontextualized from chat's multi-turn conversation to report's phase-to-phase connection tracking
  - **Usage:** Agent externalizes evidence with citations during Phases 1-2, retrieves them when writing Phase 3 report

- `phase1/analyze/streamCallbacks.ts`
  - **Purpose:** Report-specific streaming event handlers without caching overhead
  - **Differences from chat:** Removed `cache` dependency, simplified `prepareStep` to return messages as-is
  - **Rationale:** Report execution is single-shot with unique client data per case - caching provides no benefit

### Recommendation Tools (Phase 2 Sub-Agents)
- `phase1/tools/recommendDiagnostics/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diagnostics_implications.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (root causes + client context + objective), Output schema (max 7 diagnostics with rationale)
  - **Sub-agent prompt:** Clear goal, data definitions, selection philosophy (no schema overlap)

- `phase1/tools/recommendDietLifestyle/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diet & Lifestyle.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (root causes + client context + objective), Output schema (max 7 interventions with rationale)
  - **Sub-agent prompt:** Clear goal, data definitions, selection philosophy

- `phase1/tools/recommendSupplements/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Supplements & Pharmaceuticals.csv` (cached), invokes Claude Sonnet sub-agent with `generateObject`
  - **schema.ts:** Input schema (root causes + client context + objective), Output schema (max 7 supplements with rationale)
  - **Sub-agent prompt:** Clear goal, data definitions, selection philosophy

**Key principles:**
- Sub-agents are blind (no research tools, no memory, only see their inputs)
- CSV database is PRIMARY authority for each tool
- Max 7 constraint enforced in schema (`.max(7)`) forces prioritization
- Structured output via `generateObject` ensures type safety
- Primary agent provides comprehensive context about root causes and client

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
- `app/api/report/phase1/tools/` – Report-specific cognitive tools (thinkTool, researchMemoryTool).
- `app/api/report/phase1/analyze/streamCallbacks.ts` – Report-specific streaming callbacks (no caching).
- `app/api/chat/tools/` – Research tools reused (executeResearchPlanTool, targetedExtractionTool).
- `app/api/chat/lib/` – Streaming infrastructure reused (TraceLogger, TokenEconomics).
- `app/api/chat/lib/bioenergeticKnowledge.ts` – Bioenergetic framework used in all prompts.
- `docs/agentic-progress.md` – Streaming progress patterns reference.
- `docs/report_proj_overview.md` – Complete project overview and architecture principles.

## Architecture Summary

**Single-session 3-phase pipeline:**
1. **Phase 1:** Primary agent analyzes client data using interpretation guides (PRIMARY) + research (SECONDARY) → identifies fundamental root causes
2. **Phase 2:** Primary agent calls 3 recommendation tools (blind sub-agents) → receives CSV-matched interventions (max 7 each) → validates with research
3. **Phase 3:** Primary agent synthesizes concise client-facing report showing interconnections with inline citations

**Key architectural principles:**
- **Cognitive hierarchy:** Primary agent (orchestrates) → Sub-agents (specialized CSV matchers)
- **Authority hierarchy:** PRIMARY (interpretation guides, CSV databases) vs SECONDARY (research validation)
- **Prompt philosophy:** Intent over prescription, schema defines contract, enable autonomy
- **Quality constraints:** Max 7 per domain forces selection judgment, evidence-based validation
- **Streaming visibility:** Real-time progress for all operations (research, tools, extractions)


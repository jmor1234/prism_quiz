# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    ├── route.ts              # Submit endpoint: ingests submission, returns caseId
    ├── analyze/
    │   ├── route.ts          # Three-phase streaming agent endpoint
    │   └── systemPrompt.ts   # Builds 3-phase system prompt with context + interpretation guides
    ├── tools/                # Recommendation sub-agent tools
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

### Analysis Flow (Three-Phase Pipeline)
- `phase1/analyze/route.ts`
  - Three-phase streaming agent endpoint (POST with `{ caseId }`).
  - Loads submission from storage via `getPhase1Case(caseId)`.
  - Builds 3-phase system prompt with `buildPhase1SystemPrompt(submission)`.
  - Runs streaming agent with 7 tools:
    - **Chat tools (from chat route):**
      - `thinkTool` - metacognition
      - `researchMemoryTool` - working memory
      - `executeResearchPlanTool` - broad research
      - `targetedExtractionTool` - focused extraction
    - **Recommendation tools (report-specific):**
      - `recommendDiagnosticsTool` - CSV-based diagnostic matching
      - `recommendDietLifestyleTool` - CSV-based intervention matching
      - `recommendSupplementsTool` - CSV-based supplement matching
  - Reuses streaming infrastructure from chat route:
    - `TraceLogger` + `asyncLocalStorage` (progress emissions)
    - `CacheManager` (three-tier caching)
    - `TokenEconomics` (cost tracking)
    - `createStreamCallbacks` (step handlers)
  - Executes full 3-phase workflow:
    - **Phase 1:** Identify 2-5 root causes (interpretation guides PRIMARY, research SECONDARY)
    - **Phase 2:** Call recommendation tools → validate with research
    - **Phase 3:** Synthesize concise client-facing report with inline citations
  - Saves final comprehensive report to `storage/phase1-results/<caseId>.json`.
  - Max duration: 5 minutes.

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
- `app/api/chat/tools/` – Chat tools reused directly (think, memory, research, extraction).
- `app/api/chat/lib/` – All streaming infrastructure reused (TraceLogger, CacheManager, TokenEconomics, etc.).
- `app/api/chat/lib/bioenergeticKnowledge.ts` – Bioenergetic framework used in all prompts.
- `docs/agentic-progress.md` – Streaming progress patterns reference.
- `docs/report_proj_overview.md` – Complete project overview and architecture principles.

## Architecture Summary

**Single-session 3-phase pipeline:**
1. **Phase 1:** Primary agent analyzes client data using interpretation guides (PRIMARY) + research (SECONDARY) → identifies 2-5 root causes
2. **Phase 2:** Primary agent calls 3 recommendation tools (blind sub-agents) → receives CSV-matched interventions (max 7 each) → validates with research
3. **Phase 3:** Primary agent synthesizes concise client-facing report showing interconnections with inline citations

**Key architectural principles:**
- **Cognitive hierarchy:** Primary agent (orchestrates) → Sub-agents (specialized CSV matchers)
- **Authority hierarchy:** PRIMARY (interpretation guides, CSV databases) vs SECONDARY (research validation)
- **Prompt philosophy:** Intent over prescription, schema defines contract, enable autonomy
- **Quality constraints:** Max 7 per domain forces selection judgment, evidence-based validation
- **Streaming visibility:** Real-time progress for all operations (research, tools, extractions)


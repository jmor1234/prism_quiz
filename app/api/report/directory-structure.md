# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    ├── route.ts              # Submit endpoint: ingests submission, returns caseId
    ├── analyze/
    │   ├── route.ts          # Streaming agent endpoint
    │   └── systemPrompt.ts   # Builds system prompt with context + interpretation guides
    └── data/
        ├── questionaire.md   # Questionnaire interpretation guide
        ├── takehome.md       # Take-home test interpretation guide
        ├── Prsim Data - Diagnostics_implications.csv
        ├── Prsim Data - Diet & Lifestyle.csv
        └── Prsim Data - Supplements & Pharmaceuticals.csv
```

## Files

### Submission Flow
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads (validates with `phase1SubmissionSchema`).
  - Persists to `storage/phase1-submissions/<caseId>.json`.
  - Returns `{ caseId }` to frontend.

### Analysis Flow
- `phase1/analyze/route.ts`
  - Streaming agent endpoint (POST with `{ caseId }`).
  - Loads submission from storage via `getPhase1Case(caseId)`.
  - Builds system prompt with `buildPhase1SystemPrompt(submission)`.
  - Runs streaming agent with tools:
    - `thinkTool` (from chat route)
    - `researchMemoryTool` (from chat route)
    - `executeResearchPlanTool` (from chat route)
    - `targetedExtractionTool` (from chat route)
  - Reuses streaming infrastructure from chat route:
    - `TraceLogger` + `asyncLocalStorage`
    - `CacheManager` (three-tier caching)
    - `TokenEconomics` (cost tracking)
    - `createStreamCallbacks` (step handlers)
  - Saves final report to `storage/phase1-results/<caseId>.json`.
  - Max duration: 5 minutes.

- `phase1/analyze/systemPrompt.ts`
  - Loads interpretation guides from `data/` directory (cached after first load).
  - Builds system prompt with XML-tagged structure:
    - Bioenergetic knowledge framework (from `@/app/api/chat/lib/bioenergeticKnowledge`)
    - `<interpretation_guides>` (questionnaire.md + takehome.md)
    - `<client_data>` (questionnaire responses, takehome assessment, advisor notes)
    - Analysis approach instructions
    - Tool descriptions
    - Output requirements
  - Returns array of message objects for `streamText`.

### Data
- `phase1/data/questionaire.md`
  - Maps questionnaire questions to bioenergetic implications.
  - Used by agent to interpret client responses.

- `phase1/data/takehome.md`
  - Maps take-home tests to interpretations.
  - Used by agent to interpret test results.

- `phase1/data/*.csv` (not yet used)
  - Diagnostic tests database
  - Diet & lifestyle interventions database
  - Supplements & pharmaceuticals database
  - Will be used by Phase 2 recommendation sub-agents.

## Related Modules
- `server/phase1Cases.ts` – Submission persistence (`savePhase1Case`, `getPhase1Case`).
- `server/phase1Results.ts` – Result persistence (`savePhase1Result`, `getPhase1Result`).
- `lib/schemas/phase1.ts` – Shared Zod schema and constants.
- `app/api/chat/tools/` – All tools reused directly (no duplication).
- `app/api/chat/lib/` – All streaming infrastructure reused (TraceLogger, CacheManager, etc.).
- `docs/agentic-progress.md` – Streaming progress patterns reference.


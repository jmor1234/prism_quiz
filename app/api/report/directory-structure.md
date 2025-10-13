# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    ├── route.ts              # Handles Phase 1 submissions (persist case) and analysis triggers
    ├── agent.ts              # Wraps the Anthropic call for root-cause analysis
    ├── composePrompt.ts      # Builds the Phase 1 prompt from case + decision data
    ├── decisionData.ts       # Loads/caches questionnaire/take-home/knowledge files
    ├── persistence.ts        # Saves/loads Phase 1 result files
    └── runPhase1Analysis.ts  # Orchestrates prompt composition, agent call, persistence
```

## Files
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads (validates + persists) *or* `{ caseId, force?, currentDate? }` analysis triggers.
  - Submissions: Validates with `phase1SubmissionSchema`, stores via `server/phase1Cases.ts`, returns `caseId`.
  - Analysis: Runs `runPhase1Analysis` and returns the stored root-cause narrative.
- `phase1/agent.ts`
  - Calls Anthropic Sonnet 4.5 with the composed prompt and returns the generated text + token usage.
- `phase1/composePrompt.ts`
  - Pure function that stitches knowledge, decision data, and the client submission into a single prompt string.
- `phase1/decisionData.ts`
  - Provides cached loaders for `knowledge.md`, `questionaire.md`, and `takehome.md`.
- `phase1/persistence.ts`
  - Persists Phase 1 results to `storage/phase1-results/<caseId>.json` and retrieves them.
- `phase1/runPhase1Analysis.ts`
  - Entry point for executing Phase 1 analysis: loads the submission, composes prompt, runs agent, saves/returns result.

## Related Modules
- `server/phase1Cases.ts` – filesystem-backed persistence helper for Phase 1 submission records.
- `lib/schemas/phase1.ts` – shared Zod schema and constants.


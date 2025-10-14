# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    └── route.ts              # Single endpoint: ingests submission (plan/tools agent will live here)
```

## Files
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads (validates + persists) and returns `caseId`.
  - Iterative agent + tools will be implemented here (with streaming) once tools are defined.

## Related Modules
- `server/phase1Cases.ts` – filesystem-backed persistence helper for Phase 1 submission records.
- `lib/schemas/phase1.ts` – shared Zod schema and constants.
- `app/api/chat/route.ts` & `docs/agentic-progress.md` – reference patterns for agent streaming and progress emissions (to be adapted later).


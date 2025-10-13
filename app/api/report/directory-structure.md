# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    └── route.ts        # POST handler for Phase 1 submissions -> persists case record
```

## Files
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads.
  - Validates with `phase1SubmissionSchema`.
  - Delegates persistence to `server/phase1Cases.ts` and returns the canonical `caseId`.

## Related Modules
- `server/phase1Cases.ts` – filesystem-backed persistence helper for Phase 1 records.
- `lib/schemas/phase1.ts` – shared Zod schema and constants.


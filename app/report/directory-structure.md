# app/report Directory Structure

```
app/report/
├── page.tsx                 # Top-level page entry that renders the Phase1ReportForm
└── phase1-form.tsx          # Client-side form: collects inputs, submits, shows caseId (agent will run later)
```

## Files
- `page.tsx`
  - Exports the main layout shell for `/report` with title/description and mounts `Phase1ReportForm`.
- `phase1-form.tsx`
  - Full data-entry workflow (autosave, validation, attachments, submit handling).
  - Posts submission to `/api/report/phase1` and surfaces `caseId`.
  - Phase 1 agentic execution and streaming will be added later; UI currently does not run analysis.

## Related Docs
- `docs/phase1-overview.md` – high-level intent, data flow, and roadmap.


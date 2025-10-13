# app/report Directory Structure

```
app/report/
├── page.tsx                 # Top-level page entry that renders the Phase1ReportForm
└── phase1-form.tsx          # Client-side form for collecting Phase 1 inputs
```

## Files
- `page.tsx`
  - Exports the main layout shell for `/report` with title/description and mounts `Phase1ReportForm`.
- `phase1-form.tsx`
  - Full data-entry workflow (autosave, validation, attachment previews, submit handling, success state).
  - Posts to `/api/report/phase1` and surfaces returned `caseId`.

## Related Docs
- `docs/phase1-overview.md` – high-level intent, data flow, and roadmap.


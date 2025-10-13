# app/report Directory Structure

```
app/report/
├── page.tsx                 # Top-level page entry that renders the Phase1ReportForm
└── phase1-form.tsx          # Client-side form: collects inputs, submits, triggers analysis, renders report
```

## Files
- `page.tsx`
  - Exports the main layout shell for `/report` with title/description and mounts `Phase1ReportForm`.
- `phase1-form.tsx`
  - Full data-entry workflow (autosave, validation, attachments, submit handling).
  - Posts submission to `/api/report/phase1`, surfaces `caseId`, then triggers Phase 1 analysis and renders the root-cause narrative.

## Related Docs
- `docs/phase1-overview.md` – high-level intent, data flow, and roadmap.


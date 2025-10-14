# app/report Directory Structure

```
app/report/
├── page.tsx                 # Top-level page entry that renders the Phase1ReportForm
├── phase1-form.tsx          # Client-side form: collects inputs, submits, navigates to analysis
└── analysis/
    └── [caseId]/
        ├── page.tsx         # Analysis page shell (displays caseId, mounts streaming component)
        └── report-analysis-stream.tsx  # Streaming consumer and progress renderer
```

## Files

### Form Flow
- `page.tsx`
  - Exports the main layout shell for `/report` with title/description and mounts `Phase1ReportForm`.

- `phase1-form.tsx`
  - Full data-entry workflow (autosave, validation, attachments, submit handling).
  - Posts submission to `/api/report/phase1` → receives `{ caseId }`.
  - Clears localStorage and navigates to `/report/analysis/<caseId>`.

### Analysis Flow
- `analysis/[caseId]/page.tsx`
  - Dynamic route for analysis page.
  - Displays case ID and mounts `ReportAnalysisStream` component.

- `analysis/[caseId]/report-analysis-stream.tsx`
  - Manually consumes SSE stream from `/api/report/phase1/analyze`.
  - Manages streaming state (idle → streaming → complete → error).
  - Parses typed stream events:
    - `data-research-session`, `data-research-objective`, `data-research-phase`
    - `data-extraction-session`, `data-extraction-url`
    - `data-tool-status`, `data-research-collection`, `data-research-sources`
    - `text` (report content), `reasoning` (visible thinking)
  - Updates `ResearchState` for progress UI.
  - Renders:
    - `ResearchProgress` component (reused from chat)
    - `ExtractionProgress` component (reused from chat)
    - Final report in markdown (`Response` component)
    - Reasoning panel (`Reasoning` component)
  - Error handling with retry functionality.

## Related Docs
- `docs/report_proj_overview.md` – complete project overview and implementation state.


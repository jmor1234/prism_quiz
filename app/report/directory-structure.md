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
  - Full data-entry workflow with **4 required text fields:** questionnaire, takehome, advisor notes, **Dalton's final notes**.
  - **Optional PDF upload:** Previous lab results (up to 5 PDFs) - converted to base64 before submission.
  - Autosave to localStorage for all text fields, validation, submit handling.
  - Posts submission to `/api/report/phase1` with text fields + base64-encoded lab PDFs → receives `{ caseId }`.
  - Clears localStorage and navigates to `/report/analysis/<caseId>`.

### Analysis Flow
- `analysis/[caseId]/page.tsx`
  - Dynamic route for analysis page.
  - Displays case ID and mounts `ReportAnalysisStream` component.

- `analysis/[caseId]/report-analysis-stream.tsx`
  - Checks for existing result via `/api/report/phase1/result` before initiating new analysis.
  - If result exists: Loads from cache instantly (no re-run).
  - If not found: Initiates generation via POST to `/api/report/phase1/analyze`.
  - Manages generation state (idle → checking → generating → complete → error).
  - Simple loading indicator during generation (typically 2-3 minutes).
  - No real-time progress updates - generation happens on backend, frontend waits for completion.
  - After generation completes: Fetches complete report from `/api/report/phase1/result`.
  - Renders:
    - Loading state with generation status message
    - Final report in markdown (`Response` component) with **Existing Lab Results table** (if PDFs) in Assessment Findings + **Scientific References section** at bottom (curated citations organized by subsection)
    - Success confirmation when complete
  - Error handling with retry functionality.

## Related Docs
- `docs/report_proj_overview.md` – complete project overview and implementation state.


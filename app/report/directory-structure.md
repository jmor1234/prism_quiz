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
  - Autosave to localStorage for all 4 fields, validation, attachments, submit handling.
  - Posts submission to `/api/report/phase1` → receives `{ caseId }`.
  - Clears localStorage and navigates to `/report/analysis/<caseId>`.

### Analysis Flow
- `analysis/[caseId]/page.tsx`
  - Dynamic route for analysis page.
  - Displays case ID and mounts `ReportAnalysisStream` component.

- `analysis/[caseId]/report-analysis-stream.tsx`
  - Checks for existing result via `/api/report/phase1/result` before initiating new analysis.
  - If result exists: Loads from cache instantly (no re-run).
  - If not found: Initiates streaming analysis.
  - Manually consumes SSE stream from `/api/report/phase1/analyze`.
  - Manages streaming state (idle → checking → streaming → complete → error).
  - Parses typed stream events:
    - `data-research-session`, `data-research-objective`, `data-research-phase`
    - `data-extraction-session`, `data-extraction-url`
    - `data-tool-status` (shows **per-item enrichment calls**: "Enriching diagnostic: comprehensive stool test", etc.)
    - `data-research-collection`, `data-research-sources`
    - `data-report-text` (report content chunks)
    - `reasoning` (visible thinking)
  - Updates `ResearchState` for progress UI.
  - Renders:
    - `ResearchProgress` component (reused from chat)
    - `ExtractionProgress` component (reused from chat)
    - **Tool status updates** (8-15+ per-item enrichment calls visible in real-time)
    - Final report in markdown (`Response` component) - streamed in real-time with **References section** at bottom
    - Reasoning panel (`Reasoning` component)
  - Error handling with retry functionality.

## Related Docs
- `docs/report_proj_overview.md` – complete project overview and implementation state.


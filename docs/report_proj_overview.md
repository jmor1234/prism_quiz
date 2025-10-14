# Report Project Overview

## 1. Problem Statement & First-Principles Intent
- **Client reality:** Prism’s advisors collect rich qualitative and quantitative inputs (questionnaire, take-home logs, consultation notes). Historically these lived in ad-hoc notes, making consistent analysis and downstream recommendations hard to scale.
- **Goal:** Build an end-to-end pipeline that turns raw client inputs into a structured, multi-phase report:
  1. **Root-cause analysis** – Identify fundamental bioenergetic cascades for the client.
  2. **Recommendation synthesis** – Propose targeted interventions tied to those cascades.
  3. **Final report** – Deliver a coherent plan the advisor can review with the client.
- **Principle:** Capture client data once, persist it deterministically, and let each phase read from a single canonical record. This avoids repeated parsing, prevents drift, and keeps later phases reproducible.

## 2. Data Inputs & Storage
### Required Inputs (from UI)
| Field | Description | Notes |
| --- | --- | --- |
| `questionnaireText` | Raw questionnaire responses (rating scale + free text) | Ratings ≥2 indicate issues to map to implications |
| `takehomeText` | Numeric logs + short answers from take-home assessments | Includes vitals, stool logs, etc. |
| `advisorNotesText` | Consultation notes from our expert advisor | Required—carries heavy weight for analysis |
| `attachmentIds.images` | Optional image IDs (tongue photos, etc.) | Currently placeholder—IDs stored for future storage backend |
| `attachmentIds.labs` | Optional lab PDF IDs | Same as above |

### Persistence Layout (current state)
- **Submissions:** `storage/phase1-submissions/<caseId>.json`
  - Contains raw inputs + metadata (`caseId`, timestamps).
  - Written immediately when the UI submits the form.
- **Results:** `storage/phase1-results/<caseId>.json`
  - Contains Phase 1 analysis output (root-cause report) + metadata.
  - Written when Phase 1 agent completes analysis.
- **Identifiers:** `caseId` is returned to the UI and becomes the join key for later phases.

## 3. Current Implementation Snapshot (Phase 1)

### Frontend

**`app/report/phase1-form.tsx`**
- Autosave & validation using `phase1SubmissionSchema`.
- Handles attachments (UI only; backend currently stores IDs).
- On submit: POSTs to `/api/report/phase1` → persists case → receives `{ caseId }` → navigates to analysis page.

**`app/report/analysis/[caseId]/page.tsx`**
- Analysis page that displays case ID and mounts streaming component.

**`app/report/analysis/[caseId]/report-analysis-stream.tsx`**
- Manually consumes SSE stream from analyze endpoint.
- Parses streaming events (research progress, extraction progress, tool status).
- Renders real-time progress using `ResearchProgress` and `ExtractionProgress` components.
- Displays final markdown report when complete.

### Backend

**`app/api/report/phase1/route.ts`** (Submit endpoint)
- Ingests submissions (validates + persists) and returns `{ caseId }`.

**`app/api/report/phase1/analyze/route.ts`** (Streaming agent)
- Accepts `{ caseId }` and loads submission from storage.
- Builds system prompt with bioenergetic knowledge + interpretation guides + client data.
- Runs streaming agent with tools: `thinkTool`, `researchMemoryTool`, `executeResearchPlanTool`, `targetedExtractionTool`.
- Streams real-time progress via `TraceLogger`.
- Saves final report to `storage/phase1-results/<caseId>.json`.
- Max duration: 5 minutes.

**`app/api/report/phase1/analyze/systemPrompt.ts`**
- Loads interpretation guides from `data/` directory (questionnaire.md, takehome.md).
- Builds system prompt with XML-tagged structure:
  - Bioenergetic knowledge framework
  - Interpretation guides (questionnaire + takehome)
  - Client data (questionnaire responses, takehome assessment, advisor notes)
  - Analysis approach instructions
  - Tool descriptions

**`app/api/report/phase1/data/`**
- `questionaire.md` - Maps questionnaire responses to bioenergetic implications
- `takehome.md` - Interprets take-home test results
- `Prsim Data - Diagnostics_implications.csv` - Diagnostic tests database (not yet used)
- `Prsim Data - Diet & Lifestyle.csv` - Interventions database (not yet used)
- `Prsim Data - Supplements & Pharmaceuticals.csv` - Supplements database (not yet used)

### Shared Schema

**`lib/schemas/phase1.ts`**
- Enforces non-empty strings, character limits (100k), and attachment caps (8 images, 5 PDFs).
- Used by both frontend and backend for consistency.

### Persistence Helpers

**`server/phase1Cases.ts`**
- Persists canonical case records (inputs) and exposes `getPhase1Case` to rehydrate by `caseId`.

**`server/phase1Results.ts`**
- Persists Phase 1 analysis results and exposes `getPhase1Result` to retrieve by `caseId`.

## 4. What Happens Today (End-to-End Flow)
1. User completes the Phase 1 form and submits.
2. Backend stores the submission and returns `caseId`.
3. Frontend navigates to `/report/analysis/<caseId>`.
4. Analysis page automatically initiates streaming agent by calling `/api/report/phase1/analyze`.
5. Agent loads submission, builds system prompt, and runs with tools.
6. Real-time progress streams to frontend (research phases, tool status, etc.).
7. Final report generated and saved to storage.
8. Frontend displays complete root-cause analysis report.

Files written:
- `storage/phase1-submissions/<caseId>.json` (submission data)
- `storage/phase1-results/<caseId>.json` (analysis output)

## 5. Next Steps & Open Questions
1. **Phase 1 Refinement**
   - Refine system prompt with clearer objectives and output structure.
   - Improve agent instructions for using interpretation guides effectively.
   - Optimize research strategy and citation integration.

2. **Phase 2: Recommendation Synthesis**
   - Build 3 sub-agent tools (diagnostics, diet/lifestyle, supplements/pharma).
   - Each sub-agent receives Phase 1 root causes + full context + its CSV database.
   - Sub-agents use research tools for evidence-based backing.
   - Outputs combined into Phase 2 results.

3. **Phase 3: Final Report Assembly**
   - Synthesis agent weaves Phase 1 + Phase 2 together.
   - Creates coherent narrative with interconnections.
   - Final deliverable for advisor review with client.

4. **Attachment Storage Integration**
   - Replace placeholder attachment IDs with durable storage (S3/GCS) and reference links.

5. **QA & Testing**
   - Build automated tests or manual QA checklist.
   - Validate idempotency and streaming UX.

6. **Auth & Editing Lifecycle**
   - Decide who can view/run analyses.
   - Handle re-runs and versioning.

## 6. Key Files & Entry Points

### Frontend
- Form: `app/report/page.tsx` → `app/report/phase1-form.tsx`
- Analysis: `app/report/analysis/[caseId]/page.tsx` → `report-analysis-stream.tsx`

### Backend
- Submit API: `app/api/report/phase1/route.ts`
- Analyze API: `app/api/report/phase1/analyze/route.ts`
- System prompt: `app/api/report/phase1/analyze/systemPrompt.ts`
- Data: `app/api/report/phase1/data/` (interpretation guides + CSV databases)

### Shared/Server
- Schema: `lib/schemas/phase1.ts`
- Persistence: `server/phase1Cases.ts`, `server/phase1Results.ts`
- Storage: `storage/phase1-submissions/`, `storage/phase1-results/`

### Reused from Chat
- Tools: `app/api/chat/tools/` (think, memory, research, extraction)
- Streaming: `app/api/chat/lib/` (traceLogger, cacheManager, tokenEconomics, streamCallbacks)
- Knowledge: `app/api/chat/lib/bioenergeticKnowledge.ts`
- UI: `components/research-progress.tsx`, `components/extraction-progress.tsx`

## 7. Implementation Notes
- **Two-step pattern**: Submit (persist) → Analyze (stream agent execution)
- **Option B architecture**: Separate endpoints enable retry/resume without data loss
- **Tool reuse**: All chat route tools work identically in report context
- **System prompt differentiates**: Same tools, different strategic context
- **Real-time visibility**: 2-5 minute executions tolerable with streaming progress
- **Deterministic persistence**: Single source of truth for each phase

Reading this document should give a new engineer full context on what the "reports" project does today, how data flows through the system, and what work remains to complete the multi-phase pipeline.

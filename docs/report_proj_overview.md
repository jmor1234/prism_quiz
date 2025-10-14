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
- **Identifiers:** `caseId` is returned to the UI and becomes the join key for later phases.

## 3. Current Implementation Snapshot (Phase 1)
### Frontend – `app/report/phase1-form.tsx`
- Autosave & validation using `phase1SubmissionSchema`.
- Handles attachments (UI only; backend currently stores IDs).
- On submit: POSTs to `/api/report/phase1` → persists case → receives `{ caseId }` and displays it.

### Backend – `app/api/report/phase1/`
- `route.ts`
  - Ingests submissions (validates + persists) and returns `{ caseId }`.
  - This same endpoint will host the iterative agent (plan + tools + streaming) once tools are defined.

### Shared Schema – `lib/schemas/phase1.ts`
- Enforces non-empty strings, character limits (100k), and attachment caps (8 images, 5 PDFs).
- Used by both frontend and backend for consistency.

### Submission Records – `server/phase1Cases.ts`
- Persists canonical case records (inputs) and exposes `getPhase1Case` so any backend flow can rehydrate data by `caseId`.

## 4. What Happens Today (End-to-End Flow)
1. User completes the Phase 1 form and submits.
2. Backend stores the submission and returns `caseId`.
3. UI shows the `caseId` badge. (No analysis is run yet.)
4. Files written:
   - `storage/phase1-submissions/<caseId>.json`

## 5. Next Steps & Open Questions
1. **Phase 1 iterative agent + tools**
   - Implement a plan+tools agent inside `app/api/report/phase1/route.ts` that iteratively calls deterministic tools and streams progress (aligned with `docs/agentic-progress.md`).
   - Define minimal, Zod-typed tool contracts and keep emitted progress small and decision-relevant.
   - Note: We will improve and optimize the tool prompts and orchestration as we iterate (clearer instructions, derived metrics, better structure for downstream phases).
2. **Phase 2: Recommendation Synthesis**
   - Consume both the raw submission and Phase 1 report to generate actionable recommendations (diet, supplementation, lifestyle).
3. **Phase 3: Final Report Assembly**
   - Merge recommendations into a cohesive final deliverable with citations, next steps, and advisor context.
4. **Attachment Storage Integration**
   - Replace placeholder attachment IDs with durable storage (S3/GCS) and reference links.
5. **QA & Testing**
   - Build automated tests or a manual QA checklist covering submission → agent execution → persistence. Validate idempotency and streaming UX.
6. **Auth & Editing Lifecycle**
   - Decide who can view/run analyses, how re-ingestion works (versioning), and how to handle large numbers of case records.

## 6. Key Files & Entry Points
- Frontend entry: `app/report/page.tsx`
- Submission schema: `lib/schemas/phase1.ts`
- API logic: `app/api/report/phase1/route.ts` (submission ingestion now; agent later)
- Submission persistence: `server/phase1Cases.ts`
- Stored artifacts: `storage/phase1-submissions/`
- Reference knowledge docs (for future tools): `app/api/chat/data/{knowledge.md, questionaire.md, takehome.md}`

## 7. Implementation Notes
- The ingestion flow is in place; Phase 1 agentic execution will be added next in the same endpoint.
- Keep tools minimal, typed, and decision-oriented; stream compact progress per `docs/agentic-progress.md`.
- Case persistence remains in `server/phase1Cases.ts` to be reused by future phases.

Reading this document should give a new engineer full context on what the “reports” project does today, how data flows through the system, and what work remains to complete the multi-phase pipeline.

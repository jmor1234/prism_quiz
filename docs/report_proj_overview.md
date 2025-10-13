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

### Persistence Layout
- **Submissions:** `storage/phase1-submissions/<caseId>.json`
  - Contains raw inputs + metadata (`caseId`, timestamps).
  - Generated immediately when the UI submits the form.
- **Results (Phase 1):** `storage/phase1-results/<caseId>.json`
  - Contains `{ caseId, createdAt, rootCauseReport }`.
  - Written after the backend executes the Phase 1 analysis.
- **Identifiers:** `caseId` is returned to the UI and becomes the join key for later phases.

## 3. Current Implementation Snapshot (Phase 1)
### Frontend – `app/report/phase1-form.tsx`
- Autosave & validation using `phase1SubmissionSchema`.
- Handles attachments (UI only; backend currently stores IDs).
- On submit:
  1. POSTs submission to `/api/report/phase1` → persists case → receives `{ caseId }`.
  2. Immediately triggers analysis with `{ caseId }`.
  3. Displays the resulting root-cause narrative in-page.

### Backend – `app/api/report/phase1/`
- `route.ts`
  - Distinguishes between submission payloads (ingestion) and `{ caseId, force?, currentDate? }` analysis triggers.
  - Uses shared Zod schemas for validation.
- `decisionData.ts`
  - Cached loaders for `knowledge.md`, `questionaire.md`, `takehome.md` (bioenergetic guidance docs).
- `composePrompt.ts`
  - Produces a single prompt string containing the knowledge base, decision data, and the raw client submission.
- `agent.ts`
  - Calls Anthropic Sonnet 4.5 (`claude-sonnet-4-5-20250929`) with the composed prompt.
- `persistence.ts`
  - Writes/reads Phase 1 results (`storage/phase1-results/<caseId>.json`).
- `runPhase1Analysis.ts`
  - Orchestrates: load submission → check for existing result → compose prompt → run agent → persist result.

### Shared Schema – `lib/schemas/phase1.ts`
- Enforces non-empty strings, character limits (100k), and attachment caps (8 images, 5 PDFs).
- Used by both frontend and backend for consistency.

### Submission Records – `server/phase1Cases.ts`
- Persists canonical case records (inputs) and exposes `getPhase1Case` so any backend flow can rehydrate data by `caseId`.

## 4. What Happens Today (End-to-End Flow)
1. User completes the Phase 1 form and clicks “Generate root-cause analysis.”
2. Backend stores submission, returns `caseId`.
3. Backend immediately runs Phase 1 analysis for that `caseId` and stores the narrative.
4. UI shows the `caseId` badge and the generated root-cause narrative.
5. Files written:
   - `storage/phase1-submissions/<caseId>.json`
   - `storage/phase1-results/<caseId>.json`

## 5. Next Steps & Open Questions
1. **Phase 1 prompt refinement**
   - Current prompt is intentionally straightforward. We should iterate on structure, add derived metrics (e.g., average pulse) and tighten instructions to ensure high-quality, structured output for Phase 2.
2. **Phase 2: Recommendation Synthesis**
   - Consume both the raw submission and Phase 1 report to generate actionable recommendations (diet, supplementation, lifestyle).
3. **Phase 3: Final Report Assembly**
   - Merge recommendations into a cohesive final deliverable with citations, next steps, and advisor context.
4. **Attachment Storage Integration**
   - Replace placeholder attachment IDs with durable storage (S3/GCS) and reference links.
5. **QA & Testing**
   - Build automated tests or a manual QA checklist covering submission → analysis → persistence. Validate that re-running with `force` overwrites the old result.
6. **Auth & Editing Lifecycle**
   - Decide who can view/run analyses, how re-ingestion works (versioning), and how to handle large numbers of case records.

## 6. Key Files & Entry Points
- Frontend entry: `app/report/page.tsx`
- Submission schema: `lib/schemas/phase1.ts`
- API logic: `app/api/report/phase1/`
- Submission persistence: `server/phase1Cases.ts`
- Stored artifacts: `storage/phase1-submissions/`, `storage/phase1-results/`
- Knowledge docs: `app/api/chat/data/{knowledge.md, questionaire.md, takehome.md}`

## 7. Implementation Notes
- All business logic for Phase 1 now lives alongside its API route for clarity; only case persistence remains in `server/phase1Cases.ts` for reuse.
- Prompt outputs are persisted so Phase 2+ can read them without re-running Phase 1 unless explicitly forced.
- We record token usage from the agent for future observability, though we’re not storing it yet.

Reading this document should give a new engineer full context on what the “reports” project does today, how data flows through the system, and what work remains to complete the multi-phase pipeline.

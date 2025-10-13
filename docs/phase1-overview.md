# Phase 1 Client Report Pipeline – Project Overview

## Intent (First Principles)
- **Problem**: Turn raw client-provided health context into a reusable knowledge base that powers a three-phase personalized report workflow (root causes → recommendations → final plan).
- **Constraint**: Each phase may run independently, so we need a canonical, validated record of the client inputs that every backend prompt/model can read.
- **Approach**: Capture questionnaire, take-home assessment, advisor consultation notes, and optional attachments once, persist them deterministically, then let downstream phases consume the same data without depending on the front-end session.

## Data Model & Flow
- **Inputs gathered from the UI**
  - `questionnaireText`: raw exported answers (ratings + free text) from the client questionnaire.
  - `takehomeText`: numerical logs / ratings from the take-home assessments.
  - `advisorNotesText`: consultation notes written by the in-house advisor (mandatory, high-weight evidence).
  - Optional attachment IDs (`images`, `labs`): references to uploaded take-home photos or prior lab PDFs (file-store integration coming later).
- **Validation**
  - Shared Zod schema (`phase1SubmissionSchema`) enforces non-empty fields, length limits (100k chars), and attachment caps (8 images, 5 PDFs).
- **Persistence**
  - `POST /api/report/phase1` → validates the payload → stores JSON record via `server/phase1Cases.ts` under `storage/phase1-submissions/<caseId>.json`.
  - Each record contains `caseId`, timestamps, and the validated submission. Attachments are currently stored as IDs, ready to be wired to object storage.
- **Outputs**
  - Response from the endpoint returns `{ caseId }`, surfaced in the UI and used by future phases to fetch the canonical input record.

## What’s Implemented
- **Frontend**: `app/report/page.tsx` + `phase1-form.tsx`
  - Clean data-entry form with autosave, validation counts, attachment pickers, and success state showing `caseId`.
  - Uses the shared schema for client-side validation before posting.
- **Backend ingestion**: `app/api/report/phase1/route.ts`
  - Accepts JSON, validates with Zod, and persists via the server helper.
  - Returns a stable `caseId`; errors bubble up through the UI’s ErrorBanner.
- **Storage helper**: `server/phase1Cases.ts`
  - Creates the `phase1-submissions` directory as needed, writes canonical JSON records, and returns the saved record for downstream use.
- **Schemas**: `lib/schemas/phase1.ts`
  - Single source of truth for field limits and payload shape shared across client + server.

## Remaining Work (High-Level)
- **Phase 1 inference**: Build the root-cause prompt executor that loads a stored `caseId`, injects decision context (`questionaire.md`, `takehome.md`, `knowledge.md`), and produces the root-cause narrative.
- **Phase 2 & 3 pipelines**: Leverage the saved Phase 1 outputs to generate recommendations and the final report.
- **Attachment storage**: Connect uploaded images/PDFs to durable storage (e.g., S3) so attachment IDs resolve to real assets.
- **QA/Test harness**: Add automated or manual checks covering submission, persistence, retrieval, and prompt execution.
- **Auth & lifecycle**: Decide on authentication, versioning, and potential editing/resharing of case records.

## Quick Reference
- **UI entry point**: `app/report/page.tsx`
- **Submission schema**: `lib/schemas/phase1.ts`
- **API route**: `app/api/report/phase1/route.ts`
- **Storage helper**: `server/phase1Cases.ts`
- **Stored data**: `storage/phase1-submissions/<caseId>.json`

This snapshot should help any new engineer understand what inputs we collect, where they live, and how Phase 1 currently operates so they can extend the pipeline into the remaining phases.


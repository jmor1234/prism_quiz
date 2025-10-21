# Report Project Overview

## 1. Problem Statement & First-Principles Intent
- **Client reality:** Prism's advisors collect rich qualitative and quantitative inputs (questionnaire, take-home logs, consultation notes) and experts (Dalton/advisors) provide intervention directives. The system must execute these directives with intelligent enrichment at scale.
- **Goal:** Build an end-to-end pipeline that turns raw client inputs + expert directives into a structured, multi-phase report:
  1. **Directive extraction & data parsing** – Extract intervention directives from expert notes; flag client data against interpretation guides.
  2. **Directive enrichment** – Enrich each directive item with database details, personalization, and citations.
  3. **Final report** – Deliver a coherent plan executing expert directives with bioenergetic context.
- **Principle:** Capture client data once, persist it deterministically, and let each phase read from a single canonical record. Human expertise drives interventions; AI executes and enriches at scale.

## 2. Data Inputs & Storage
### Required Inputs (from UI)
| Field | Description | Notes |
| --- | --- | --- |
| `questionnaireText` | Raw questionnaire responses (rating scale + free text) | Ratings ≥2 indicate issues to map to interpretation guide implications |
| `takehomeText` | Numeric logs + short answers from take-home assessments | Includes vitals, stool logs, etc. |
| `advisorNotesText` | Consultation notes from advisor | SECONDARY directives—fallback guidance |
| `daltonsFinalNotes` | Final intervention directives from Dalton | PRIMARY directives—carries most weight |
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

## 3. Current Implementation Snapshot (Directive-Driven Three-Phase System)

### Frontend

**`app/report/phase1-form.tsx`**
- **Four required text fields:** questionnaire, takehome, advisor notes, **Dalton's final notes**
- Autosave & validation using `phase1SubmissionSchema`.
- Handles attachments (UI only; backend currently stores IDs).
- On submit: POSTs to `/api/report/phase1` → persists case → receives `{ caseId }` → navigates to analysis page.

**`app/report/analysis/[caseId]/page.tsx`**
- Analysis page that displays case ID and mounts streaming component.

**`app/report/analysis/[caseId]/report-analysis-stream.tsx`**
- Checks for existing result before initiating new analysis (prevents re-running on refresh).
- Manually consumes SSE stream from analyze endpoint.
- Parses streaming events (research progress, extraction progress, tool status, report text).
- Renders real-time progress using `ResearchProgress` and `ExtractionProgress` components.
- Displays final markdown report when complete (streamed in real-time or loaded from cache).

### Backend

**`app/api/report/phase1/route.ts`** (Submit endpoint)
- Ingests submissions (validates + persists) and returns `{ caseId }`.

**`app/api/report/phase1/result/route.ts`** (Result retrieval endpoint)
- GET endpoint that retrieves existing analysis results by `caseId`.
- Returns `{ report, createdAt }` if found, 404 if not found.
- Used by frontend to check for cached results before re-running analysis.

**`app/api/report/phase1/analyze/route.ts`** (Directive-driven three-phase streaming agent)
- Accepts `{ caseId }` and loads submission from storage.
  - Builds system prompt with bioenergetic knowledge + interpretation guides + client data + **Dalton's final notes**.
  - Runs streaming agent with 6 tools:
  - **Report-specific cognitive tool:** `reportThinkTool`
  - **Research tools:** `executeResearchPlanTool`, `targetedExtractionTool`
  - **Recommendation tools (per-item enrichment):** `recommendDiagnosticsTool`, `recommendDietLifestyleTool`, `recommendSupplementsTool`
- Streams real-time progress via `TraceLogger`.
- Streams report text via custom `data-report-text` events (manually consumed from `result.textStream`).
- Executes full 3-phase workflow:
  - **Phase 1:** Extract directives from Dalton's/Advisor notes; parse questionnaire/takehome data
  - **Phase 2:** Map data to guide implications; enrich each directive item via per-item tool calls (8-15+); gather citations
  - **Phase 3:** Build References section; stream final report
- Saves final report to `storage/phase1-results/<caseId>.json`.
- Max duration: 15 minutes.

**`app/api/report/phase1/analyze/systemPrompt.ts`**
- Loads interpretation guides from `data/` directory (questionnaire.md, takehome.md).
- Builds directive-driven 3-phase system prompt:
  - Prism context and bioenergetic knowledge framework
  - Interpretation guides (questionnaire + takehome)
  - Client data (questionnaire responses, takehome assessment, advisor notes, **Dalton's final notes**)
  - **Agent role:** Executor & Enricher (not decision-maker)
  - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
  - Phase 1: Extract directives; parse questionnaire/takehome against guides
  - Phase 2: Map to guide implications; enrich directives with per-item tool calls; gather citations
  - Phase 3: Build References section; stream final report

**`app/api/report/phase1/tools/`** (Recommendation sub-agents - per-item enrichment)
- **`recommendDiagnostics/`** - Enriches single diagnostic directive with database details
- **`recommendDietLifestyle/`** - Enriches single diet/lifestyle directive with implementation guidance
- **`recommendSupplements/`** - Enriches single supplement directive with dosage/sourcing
- Each tool:
  - Loads its CSV database (cached after first load)
  - Receives **requested item** (from directives) + client context + objective from primary agent
  - Uses Claude Sonnet sub-agent with `generateObject` for structured lookup
  - Returns **discriminated union:**
    - `type: "specific"` → single enriched match with personalized details
    - `type: "options"` → 2-5 potential matches when directive is ambiguous (agent decides or recalls)
  - Called 8-15+ times per report (once per directive item)

**`app/api/report/phase1/data/`**
- `questionaire.md` - Maps questionnaire responses to bioenergetic implications (PRIMARY authority for Phase 1)
- `takehome.md` - Interprets take-home test results (PRIMARY authority for Phase 1)
- `Prsim Data - Diagnostics_implications.csv` - Diagnostic tests database (used by recommendDiagnosticsTool)
- `Prsim Data - Diet & Lifestyle.csv` - Interventions database (used by recommendDietLifestyleTool)
- `Prsim Data - Supplements & Pharmaceuticals.csv` - Supplements database (used by recommendSupplementsTool)

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
1. User completes the Phase 1 form with **4 required fields** (questionnaire, takehome, advisor notes, **Dalton's final notes**) and submits.
2. Backend stores the submission and returns `caseId`.
3. Frontend navigates to `/report/analysis/<caseId>`.
4. Analysis page checks for existing result:
   - **If exists:** Loads cached report from storage (instant display, no re-run)
   - **If not found:** Initiates streaming agent by calling `/api/report/phase1/analyze`
5. Agent loads submission, builds directive-driven 3-phase system prompt, and executes:
   - **Phase 1:** Extract directives from Dalton's/Advisor notes → parse questionnaire/takehome data → flag items ≥2 against interpretation guides
   - **Phase 2:** Map flagged items to guide implications → enrich each directive item via per-item tool calls (8-15+) → gather citations via research
   - **Phase 3:** Build References section with academic format → stream final report
6. Real-time progress streams to frontend:
   - Research sessions/objectives/phases (executeResearchPlanTool)
   - Tool status (think, **per-item recommendation enrichment calls**)
   - Extraction progress (targetedExtractionTool)
   - Report text chunks (data-report-text events)
7. Final comprehensive report generated and saved to storage.
8. Frontend displays complete directive-driven report as it streams in real-time.
9. On page refresh: Cached result loads instantly from storage (no re-analysis).

Files written:
- `storage/phase1-submissions/<caseId>.json` (submission data)
- `storage/phase1-results/<caseId>.json` (full 3-phase report)

## 5. Current Status & Next Steps

### ✅ Completed (Directive-Driven Paradigm Refactor)
1. **Full 3-Phase Directive-Driven Pipeline** - Implemented in single streaming session
   - Phase 1: Directive extraction + data parsing against interpretation guides
   - Phase 2: Guide implication mapping + per-item directive enrichment (8-15+ tool calls)
   - Phase 3: References section building + final report streaming
   - **Status:** Refactored from analysis-driven to directive-driven architecture

2. **Per-Item Enrichment Tool Architecture**
   - Discriminated union schemas (`"specific" | "options"`) for flexible matching
   - CSV database caching for performance
   - Sub-agents use `generateObject` for structured lookup + enrichment
   - Called once per directive item (not batch selection)
   - Streaming tool status for UX visibility
   - **Status:** All 3 tools refactored (diagnostics, diet/lifestyle, supplements)

3. **Streaming & Caching**
   - Real-time text streaming via custom `data-report-text` events
   - Progress UI updates (research, tool status, extractions)
   - Result caching prevents re-analysis on page refresh
   - Instant load from storage for existing results
   - **Status:** Fully functional with proper event format alignment

4. **Prompt Design Philosophy**
   - Clear separation: Prompt = intent, Schema = contract
   - Data definitions (what each section IS)
   - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent (gaps only)
   - **Agent role:** Executor & Enricher (not decision-maker)
   - Non-prescriptive approach enabling agent autonomy within bounded context
   - **Status:** Refactored to directive-driven paradigm

### 🔄 Next Steps
1. **Validation with Directive-Driven Flow**
   - Test with real Dalton's directives in free-form prose
   - Validate directive extraction quality
   - Test per-item tool enrichment flow (specific vs options handling)
   - Monitor execution times with 8-15+ tool calls
   - Verify References section format and citation quality

2. **Optimization**
   - Fine-tune directive extraction from unstructured notes
   - Optimize research strategy for citation gathering (Phase 3 only)
   - Refine vague directive → options → decision flow

3. **Future Enhancements**
   - Attachment storage integration (S3/GCS)
   - Structured output for programmatic access
   - Auth & editing lifecycle
   - Re-run and versioning capabilities

## 6. Key Files & Entry Points

### Frontend
- Form: `app/report/page.tsx` → `app/report/phase1-form.tsx`
- Analysis: `app/report/analysis/[caseId]/page.tsx` → `report-analysis-stream.tsx`

### Backend
- Submit API: `app/api/report/phase1/route.ts`
- Result retrieval API: `app/api/report/phase1/result/route.ts`
- Analyze API (3-phase): `app/api/report/phase1/analyze/route.ts`
- System prompt (3-phase): `app/api/report/phase1/analyze/systemPrompt.ts`
- Recommendation tools: `app/api/report/phase1/tools/` (3 sub-agent tools)
- Data: `app/api/report/phase1/data/` (interpretation guides + CSV databases)

### Shared/Server
- Schema: `lib/schemas/phase1.ts`
- Persistence: `server/phase1Cases.ts`, `server/phase1Results.ts`
- Storage: `storage/phase1-submissions/`, `storage/phase1-results/`

### Reused from Chat
- Tools: `app/api/chat/tools/` (research, extraction)
- Streaming: `app/api/chat/lib/` (traceLogger, tokenEconomics)
- Knowledge: `app/api/chat/lib/bioenergeticKnowledge.ts`
- UI: `components/research-progress.tsx`, `components/extraction-progress.tsx`

### Report-Specific
- Cognitive tool: `app/api/report/phase1/tools/thinkTool.ts` (extraction tracking, enrichment planning, completion verification)
- Streaming callbacks: `app/api/report/phase1/analyze/streamCallbacks.ts` (no caching)

## 7. Implementation Notes
- **Two-step pattern**: Submit (persist) → Analyze (stream 3-phase execution)
- **Single-session architecture**: All 3 phases execute in one streaming session for coherent context
- **Directive-driven paradigm**: Agent executes expert directives, not autonomous decisions
- **Tool composition**: Report-specific cognitive tool (think) + Research tools + Per-item recommendation tools (CSV enrichment)
- **Per-item enrichment**: 8-15+ tool calls per report (once per directive item) vs old 3 batch calls
- **Discriminated unions**: Tools return `"specific" | "options"` enabling flexible matching flows
- **No caching**: Report execution is single-shot with unique client data - caching provides no benefit
- **System prompt differentiates**: Directive-driven report with bounded agent autonomy vs chat's open-ended exploration
- **Real-time visibility**: Multi-minute executions with streaming progress (research, per-item tool status, extractions, report text)
- **Deterministic persistence**: Single source of truth - submission (with Dalton's notes) + final comprehensive report
- **Sub-agent isolation**: Recommendation tools are blind (only see requested item + context) - no research tools
- **Authority hierarchy**: Dalton's notes (PRIMARY directives) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
- **Prompt philosophy**: Intent over prescription, schema handles contract, enabling agent autonomy within bounded context

## 8. Architecture Principles

### Cognitive Architecture
- **Primary agent**: Executor & Enricher orchestrating all 3 phases with full context and all tools
- **Sub-agents**: Specialized CSV lookup + enrichment - receive requested item, return match(es) with details
- **Tools as cognitive extensions**: Each tool extends specific capability (think, research, extraction, per-item enrichment)
- **Context flows downward**: Primary agent provides comprehensive context to sub-agents who are otherwise blind
- **Directive-driven**: Agent executes expert directives, not autonomous clinical decisions

### Prompt Design
- **Separation of concerns**: Prompt defines intent and data, Schema defines contract
- **No overlap**: Avoid repeating schema descriptions in prompts
- **Data clarity**: Explicitly state what each injected section IS
- **Enable autonomy**: Philosophy over rigid steps, let intelligence emerge within bounded context
- **Role clarity**: Agent is Executor & Enricher, not decision-maker

### Quality Constraints
- **Per-item enrichment**: Tools enrich one directive at a time with database details
- **Discriminated unions**: Clear contract for specific vs ambiguous matches
- **Evidence-based**: Research tools gather citations (not validation)
- **Interconnected**: Final synthesis explains how assessment findings and interventions connect through bioenergetic principles
- **Actionable**: Client knows what to do next based on expert directives

Reading this document should give a new engineer full context on what the "reports" project does today, how data flows through the system, and the architectural principles guiding implementation.

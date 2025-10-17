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

## 3. Current Implementation Snapshot (Full Three-Phase System)

### Frontend

**`app/report/phase1-form.tsx`**
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

**`app/api/report/phase1/analyze/route.ts`** (Three-phase streaming agent)
- Accepts `{ caseId }` and loads submission from storage.
  - Builds system prompt with bioenergetic knowledge + interpretation guides + client data.
  - Runs streaming agent with 7 tools:
  - **Report-specific cognitive tools:** `reportThinkTool`, `reportResearchMemoryTool`
  - **Research tools:** `executeResearchPlanTool`, `targetedExtractionTool`
  - **Recommendation tools:** `recommendDiagnosticsTool`, `recommendDietLifestyleTool`, `recommendSupplementsTool`
- Streams real-time progress via `TraceLogger`.
- Streams report text via custom `data-report-text` events (manually consumed from `result.textStream`).
- Executes full 3-phase workflow:
  - **Phase 1:** Identify root causes using interpretation guides (PRIMARY) + research (SECONDARY)
  - **Phase 2:** Call recommendation tools → get CSV-matched interventions → validate with research
  - **Phase 3:** Synthesize client-facing report with inline citations
- Saves final report to `storage/phase1-results/<caseId>.json`.
- Max duration: 15 minutes.

**`app/api/report/phase1/analyze/systemPrompt.ts`**
- Loads interpretation guides from `data/` directory (questionnaire.md, takehome.md).
- Builds 3-phase system prompt:
  - Prism context and bioenergetic knowledge framework
  - Interpretation guides (questionnaire + takehome)
  - Client data (questionnaire responses, takehome assessment, advisor notes)
  - Phase 1: Root cause identification with authority hierarchy
  - Phase 2: Recommendation generation via tools
  - Phase 3: Concise client-facing synthesis with interconnections and citations

**`app/api/report/phase1/tools/`** (Recommendation sub-agents)
- **`recommendDiagnostics/`** - Matches diagnostic tests from CSV to root causes (max 7)
- **`recommendDietLifestyle/`** - Matches diet/lifestyle interventions from CSV to root causes (max 7)
- **`recommendSupplements/`** - Matches supplements/pharma from CSV to root causes (max 7)
- Each tool:
  - Loads its CSV database (cached after first load)
  - Receives root causes + client context + objective from primary agent
  - Uses Claude Sonnet sub-agent with `generateObject` for structured selection
  - Returns highest-impact recommendations based on severity and client concerns

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
1. User completes the Phase 1 form and submits.
2. Backend stores the submission and returns `caseId`.
3. Frontend navigates to `/report/analysis/<caseId>`.
4. Analysis page checks for existing result:
   - **If exists:** Loads cached report from storage (instant display, no re-run)
   - **If not found:** Initiates streaming agent by calling `/api/report/phase1/analyze`
5. Agent loads submission, builds 3-phase system prompt, and executes:
   - **Phase 1:** Analyze client data → identify fundamental root causes using interpretation guides + research
   - **Phase 2:** Call 3 recommendation tools with root cause context → get CSV-matched interventions (max 7 each) → validate with research for evidence
   - **Phase 3:** Synthesize concise client-facing report showing interconnections with inline citations
6. Real-time progress streams to frontend:
   - Research sessions/objectives/phases (executeResearchPlanTool)
   - Tool status (think, memory, recommendation tools)
   - Extraction progress (targetedExtractionTool)
   - Report text chunks (data-report-text events)
7. Final comprehensive report generated and saved to storage.
8. Frontend displays complete 3-phase report as it streams in real-time.
9. On page refresh: Cached result loads instantly from storage (no re-analysis).

Files written:
- `storage/phase1-submissions/<caseId>.json` (submission data)
- `storage/phase1-results/<caseId>.json` (full 3-phase report)

## 5. Current Status & Next Steps

### ✅ Completed (Validated with Real Client Data)
1. **Full 3-Phase Pipeline** - Implemented in single streaming session
   - Phase 1: Root cause identification with interpretation guides
   - Phase 2: Three recommendation sub-agent tools with CSV matching
   - Phase 3: Client-facing synthesis with interconnections and citations
   - **Status:** Validated end-to-end with real client data, produces production-quality reports

2. **Recommendation Tools Architecture**
   - Schema-driven with `.max(7)` constraints for focused recommendations
   - CSV database caching for performance
   - Sub-agents use `generateObject` for structured output
   - Streaming tool status for UX visibility
   - **Status:** All 3 tools (diagnostics, diet/lifestyle, supplements) functioning correctly

3. **Streaming & Caching**
   - Real-time text streaming via custom `data-report-text` events
   - Progress UI updates (research, tool status, extractions)
   - Result caching prevents re-analysis on page refresh
   - Instant load from storage for existing results
   - **Status:** Fully functional with proper event format alignment

4. **Prompt Design Philosophy**
   - Clear separation: Prompt = intent, Schema = contract
   - Data definitions (what each section IS)
   - Authority hierarchy (PRIMARY vs SECONDARY)
   - Non-prescriptive approach enabling agent autonomy
   - **Status:** Produces high-quality, personalized, evidence-based reports

### 🔄 Next Steps
1. **Continued Validation**
   - Test with additional diverse client cases
   - Monitor output consistency and quality
   - Gather feedback from advisors on report usefulness
   - Track execution times and costs

2. **Optimization**
   - Fine-tune recommendation selection quality
   - Optimize research strategy for Phase 1 and Phase 2 validation
   - Refine citation integration

3. **Future Enhancements**
   - Attachment storage integration (S3/GCS)
   - Structured output from Phase 1 for programmatic access
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
- Cognitive tools: `app/api/report/phase1/tools/` (thinkTool, researchMemoryTool)
- Streaming callbacks: `app/api/report/phase1/analyze/streamCallbacks.ts` (no caching)

## 7. Implementation Notes
- **Two-step pattern**: Submit (persist) → Analyze (stream 3-phase execution)
- **Single-session architecture**: All 3 phases execute in one streaming session for coherent context
- **Tool composition**: Report-specific cognitive tools (think, memory) + Research tools + Recommendation tools (CSV matching)
- **No caching**: Report execution is single-shot with unique client data - caching provides no benefit
- **System prompt differentiates**: Report context with 3-phase structure vs chat's open-ended exploration
- **Real-time visibility**: Multi-minute executions with streaming progress (research, tool status, extractions, report text)
- **Deterministic persistence**: Single source of truth - submission + final comprehensive report
- **Sub-agent isolation**: Recommendation tools are blind (only see their inputs) - no research tools, no memory
- **Authority hierarchy**: PRIMARY (interpretation guides, CSV databases) vs SECONDARY (research validation)
- **Prompt philosophy**: Intent over prescription, schema handles contract, enabling agent autonomy

## 8. Architecture Principles

### Cognitive Architecture
- **Primary agent**: Orchestrates all 3 phases with full context and all tools
- **Sub-agents**: Specialized CSV matchers - receive structured input, return structured output
- **Tools as cognitive extensions**: Each tool extends specific capability (think, memory, research, extraction, recommendation)
- **Context flows downward**: Primary agent provides comprehensive context to sub-agents who are otherwise blind

### Prompt Design
- **Separation of concerns**: Prompt defines intent and data, Schema defines contract
- **No overlap**: Avoid repeating schema descriptions in prompts
- **Data clarity**: Explicitly state what each injected section IS
- **Enable autonomy**: Philosophy over rigid steps, let intelligence emerge

### Quality Constraints
- **Max 7 per domain**: Hard schema limit forces prioritization and selection judgment
- **Evidence-based**: Research tools validate recommendations with citations
- **Interconnected**: Final synthesis explains how root causes, interventions, and bioenergetic principles connect
- **Actionable**: Client knows what to do next

Reading this document should give a new engineer full context on what the "reports" project does today, how data flows through the system, and the architectural principles guiding implementation.

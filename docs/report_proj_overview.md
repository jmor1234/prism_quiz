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
| `labPdfs` | Optional previous lab results (up to 5 PDFs) | Base64-encoded PDF data with filename and mediaType - used for existing lab analysis |

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
- **Optional PDF upload:** Previous lab results (up to 5 PDFs) - converted to base64 on submit
- Autosave to localStorage for text fields and lab filenames (PDFs must be re-uploaded on refresh).
- Validation using `phase1SubmissionSchema`.
- On submit: Converts PDFs to base64 → POSTs to `/api/report/phase1` with text + base64 lab data → receives `{ caseId }` → navigates to analysis page.

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
- Ingests submissions: 4 text fields + optional base64-encoded lab PDFs.
- Validates with `phase1SubmissionSchema` (includes `labPdfs` array).
- Persists complete submission (text + PDF data) to storage.
- Returns `{ caseId }`.

**`app/api/report/phase1/result/route.ts`** (Result retrieval endpoint)
- GET endpoint that retrieves existing analysis results by `caseId`.
- Returns `{ report, createdAt }` if found, 404 if not found.
- Used by frontend to check for cached results before re-running analysis.

**`app/api/report/phase1/analyze/route.ts`** (Directive-driven three-phase streaming agent)
- Accepts `{ caseId }` and loads submission from storage.
- **Passes submission via asyncLocalStorage** for tool access (enables PDF bypass pattern).
- Builds system prompt with bioenergetic knowledge + interpretation guides + client data + **Dalton's final notes** + PDF indicator.
- Runs streaming agent (Sonnet 4.5) with 6 tools:
  - **Report-specific cognitive tool:** `reportThinkTool`
  - **Lab analysis tool (one-shot):** `analyzeExistingLabsTool` - Sonnet 4.5 sub-agent with multimodal PDF injection
  - **Recommendation tools (per-item enrichment):** `recommendDiagnosticsTool`, `recommendDietLifestyleTool`, `recommendSupplementsTool` - Gemini Flash sub-agents
  - **Citation tool:** `gatherCitationsTool`
- Streams real-time progress via `TraceLogger`.
- Streams report text via custom `data-report-text` events (manually consumed from `result.textStream`).
- Executes full 3-phase workflow:
  - **Phase 1:** Extract directives from Dalton's/Advisor notes; parse questionnaire/takehome data
  - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool ONCE (comprehensive analysis) → map data to guide implications → enrich each directive item via per-item tool calls (8-15+) → organize citation needs and call gatherCitationsTool once
  - **Phase 3:** Format References section from citation data → stream final report with Existing Lab Results table (if PDFs analyzed)
- Saves final report to `storage/phase1-results/<caseId>.json`.
- Max duration: 15 minutes.

**`app/api/report/phase1/analyze/systemPrompt.ts`**
- Loads interpretation guides from `data/` directory (questionnaire.md, takehome.md).
- Builds directive-driven 3-phase system prompt:
  - Prism context and bioenergetic knowledge framework
  - Interpretation guides (questionnaire + takehome)
  - Client data (questionnaire responses, takehome assessment, advisor notes, **Dalton's final notes**, `<previous_labs_uploaded>` indicator if PDFs present)
  - **Agent role:** Executor & Enricher (not decision-maker)
  - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
  - Phase 1: Extract directives; parse questionnaire/takehome against guides
  - Phase 2: If PDFs uploaded: call analyzeExistingLabsTool ONCE (comprehensive analysis); map to guide implications; enrich directives with per-item tool calls; organize citation topics and call gatherCitationsTool
  - Phase 3: Format References section; if labs analyzed: include Existing Lab Results table in Assessment Findings; stream final report

**`app/api/report/phase1/tools/analyzeExistingLabs/`** (Lab analysis tool - one-shot comprehensive analysis)
- **Purpose:** Analyze client's existing lab results from uploaded PDFs using Prism's diagnostic framework
- **Flow:**
  1. Accesses PDFs via `getSubmission()` from asyncLocalStorage (bypasses primary agent's context)
  2. Loads Diagnostics CSV (cached, same database as recommendDiagnosticsTool)
  3. Invokes **Sonnet 4.5** sub-agent with multimodal message (text prompt + CSV + PDF files)
  4. Sub-agent extracts lab values from PDFs, matches against CSV, assesses using Prism's Ranges when available
  5. Returns structured findings array (test, result, optional assessment with Prism's Range, implication)
- **Files:**
  - `tool.ts` - Tool definition with streaming status
  - `agent.ts` - Sonnet 4.5 sub-agent with multimodal PDF injection + CSV database + bioenergetic framework
  - `schema.ts` - Input (clientProfile + analysisObjective), Output (findings array + optional synthesis)
- **Token logging:** Logs inputTokens, outputTokens, totalTokens for cost visibility
- **Execution:** ~5-10 seconds depending on PDF complexity
- **Key principles:**
  - **One-shot pattern:** Called ONCE per report to analyze ALL uploaded PDFs comprehensively
  - **Context bypass:** PDFs never flow through primary agent's context (preserves economy)
  - **Sonnet 4.5 model:** Quality medical reasoning for PDF extraction + clinical interpretation
  - **Optional assessment field:** Handles tests with and without Prism's Ranges (flexible schema)
  - **Placement:** Results integrated into Assessment Findings as "Existing Lab Results" table

**`app/api/report/phase1/tools/`** (Recommendation sub-agents - per-item enrichment)
- **`recommendDiagnostics/`** - Enriches single diagnostic directive with database details
- **`recommendDietLifestyle/`** - Enriches single diet/lifestyle directive with implementation guidance
- **`recommendSupplements/`** - Enriches single supplement directive with dosage/sourcing
- Each tool:
  - Loads its CSV database (cached after first load)
  - Receives **requested item** (from directives) + client context + objective from primary agent
  - Uses **Gemini 2.5 Flash** sub-agent with `generateObject` for fast, cost-effective structured lookup + personalization
  - Returns **discriminated union:**
    - `type: "specific"` → single enriched match with personalized details
    - `type: "options"` → 2-5 potential matches when directive is ambiguous (agent decides or recalls)
  - Called 8-15+ times per report (once per directive item)
  - **Execution:** ~0.5-1s per call (faster than Sonnet, cheaper)

**`app/api/report/phase1/tools/gatherCitations/`** (Citation gathering + curation tool)
- **Purpose:** Gather and curate academic citations to support report content (solves context obliteration problem)
- **Flow:**
  1. Receives citation requests organized by subsection with specific topics (e.g., 28 topics across 4 subsections)
  2. Executes parallel Exa neural searches (12 concurrent, 10 results per topic, `category: "research paper"`)
  3. Groups results by subsection and deduplicates URLs
  4. **Curates intelligently** via **Gemini 2.5 Flash** sub-agent (selects 10 most relevant per subsection from ~70 gathered)
  5. Returns ~40 curated citations to primary agent (not 280)
- **Files:**
  - `tool.ts` - Tool definition with streaming status
  - `executor.ts` - 5-step orchestration: flatten → search → group → deduplicate → curate
  - `curator.ts` - Gemini Flash sub-agent for relevance-based selection (intent-focused prompt)
  - `schema.ts` - Input (citationRequests by subsection), Output (curated citations by subsection)
  - `constants.ts` - Config (RESULTS_PER_TOPIC=10, CITATIONS_PER_SUBSECTION=10, concurrency=12, model)
- **Execution:** ~5 seconds total (3s gathering + 2s curation)
- **Context preservation:** Primary agent receives 40 manageable citations instead of 280
- **Output:** Pre-organized citations by subsection, ready for References formatting

**`app/api/report/phase1/data/`**
- `questionaire.md` - Maps questionnaire responses to bioenergetic implications (PRIMARY authority for Phase 1)
- `takehome.md` - Interprets take-home test results (PRIMARY authority for Phase 1)
- `Prsim Data - Diagnostics_implications.csv` - Diagnostic tests database (242 entries)
  - Used by analyzeExistingLabsTool (existing lab analysis) AND recommendDiagnosticsTool (future diagnostic enrichment)
  - Columns: Diagnostic, Implication, (empty), Prism's Ranges, Where to get
- `Prsim Data - Diet & Lifestyle.csv` - Interventions database (used by recommendDietLifestyleTool)
- `Prsim Data - Supplements & Pharmaceuticals.csv` - Supplements database (used by recommendSupplementsTool)

### Shared Schema

**`lib/schemas/phase1.ts`**
- Enforces non-empty strings, character limits (100k), and PDF attachment caps (5 PDFs).
- Defines `pdfFileSchema` for base64-encoded PDFs (filename, data, mediaType).
- Includes `labPdfs` optional array in submission schema.
- Used by both frontend and backend for consistency.

### Persistence Helpers

**`server/phase1Cases.ts`**
- Persists canonical case records (inputs) and exposes `getPhase1Case` to rehydrate by `caseId`.

**`server/phase1Results.ts`**
- Persists Phase 1 analysis results and exposes `getPhase1Result` to retrieve by `caseId`.

## 4. What Happens Today (End-to-End Flow)
1. User completes the Phase 1 form with **4 required fields** (questionnaire, takehome, advisor notes, **Dalton's final notes**) + **optional lab PDFs** (up to 5) and submits.
2. Frontend converts PDFs to base64 → POSTs to backend with text + PDF data.
3. Backend stores complete submission (text + base64 PDFs) and returns `caseId`.
4. Frontend navigates to `/report/analysis/<caseId>`.
5. Analysis page checks for existing result:
   - **If exists:** Loads cached report from storage (instant display, no re-run)
   - **If not found:** Initiates streaming agent by calling `/api/report/phase1/analyze`
6. Agent loads submission (passed via asyncLocalStorage), builds directive-driven 3-phase system prompt, and executes:
   - **Phase 1:** Extract directives from Dalton's/Advisor notes → parse questionnaire/takehome data → flag items ≥2 against interpretation guides
   - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool ONCE (Sonnet 4.5 analyzes all PDFs via multimodal injection, returns structured findings) → map flagged items to guide implications → enrich each directive item via per-item tool calls (8-15+) → organize citation topics and call gatherCitationsTool once
   - **Phase 3:** Format References section from citation data → if labs analyzed: include Existing Lab Results table in Assessment Findings → stream final report
7. Real-time progress streams to frontend:
   - Tool status (think, **lab analysis** (if PDFs), **per-item recommendation enrichment calls**, citation gathering)
   - Report text chunks (data-report-text events)
8. Final comprehensive report generated and saved to storage.
9. Frontend displays complete directive-driven report with Existing Lab Results table (if PDFs uploaded) as it streams in real-time.
10. On page refresh: Cached result loads instantly from storage (no re-analysis).

Files written:
- `storage/phase1-submissions/<caseId>.json` (submission data)
- `storage/phase1-results/<caseId>.json` (full 3-phase report)

## 5. Current Status & Next Steps

### ✅ Completed (Directive-Driven Paradigm Refactor)
1. **Full 3-Phase Directive-Driven Pipeline** - Implemented in single streaming session
   - Phase 1: Directive extraction + data parsing against interpretation guides
   - Phase 2: Guide implication mapping + per-item directive enrichment (8-15+ tool calls) + citation gathering
   - Phase 3: References section formatting + final report streaming
   - **Status:** Optimized with purpose-built citation tool

2. **Per-Item Enrichment Tool Architecture** - Optimized with Gemini Flash
   - Discriminated union schemas (`"specific" | "options"`) for flexible matching
   - CSV database caching for performance
   - Sub-agents use **Gemini 2.5 Flash** with `generateObject` for fast, cost-effective structured lookup + personalization
   - Called once per directive item (not batch selection) - 8-15+ calls per report
   - Streaming tool status for UX visibility
   - **Performance:** ~0.5-1s per call (3-5x faster than Sonnet, 10-15x cheaper)
   - **Status:** All 3 recommendation tools migrated to Gemini Flash

3. **Citation Gathering Tool** - Purpose-built with intelligent curation
   - Comprehensive Exa neural search across topics (12 concurrent, 10 results per topic, ~280 total)
   - **Intelligent curation** via Gemini Flash sub-agent (selects 10 most relevant per subsection from ~70)
   - Returns ~40 curated citations (not 280) to preserve primary agent context
   - Execution: ~5 seconds (3s gathering + 2s curation)
   - Replaces research tools for citation use case (20-40x faster, much cheaper)
   - **Architecture:** Internal curation transparent to primary agent (clean abstraction)
   - **Status:** Fully implemented with curator sub-agent

4. **Streaming & Caching**
   - Real-time text streaming via custom `data-report-text` events
   - Progress UI updates (tool status for recommendations and citations)
   - Result caching prevents re-analysis on page refresh
   - Instant load from storage for existing results
   - **Status:** Fully functional with proper event format alignment

5. **Prompt Design Philosophy**
   - Clear separation: Prompt = intent, Schema = contract
   - Data definitions (what each section IS)
   - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent (gaps only)
   - **Agent role:** Executor & Enricher (not decision-maker)
   - Non-prescriptive approach enabling agent autonomy within bounded context
   - **Status:** Applied consistently across all tools and sub-agents

## 6. Key Files & Entry Points

### Frontend
- Form: `app/report/page.tsx` → `app/report/phase1-form.tsx`
- Analysis: `app/report/analysis/[caseId]/page.tsx` → `report-analysis-stream.tsx`

### Backend
- Submit API: `app/api/report/phase1/route.ts`
- Result retrieval API: `app/api/report/phase1/result/route.ts`
- Analyze API (3-phase): `app/api/report/phase1/analyze/route.ts`
- System prompt (3-phase): `app/api/report/phase1/analyze/systemPrompt.ts`
- Recommendation tools: `app/api/report/phase1/tools/` (3 Gemini Flash sub-agent tools)
- Citation tool: `app/api/report/phase1/tools/gatherCitations/` (Exa + Gemini Flash curation)
- Data: `app/api/report/phase1/data/` (interpretation guides + CSV databases)

### Shared/Server
- Schema: `lib/schemas/phase1.ts`
- Persistence: `server/phase1Cases.ts`, `server/phase1Results.ts`
- Storage: `storage/phase1-submissions/`, `storage/phase1-results/`

### Reused from Chat
- Exa client: `app/api/chat/tools/researchOrchestratorTool/exaSearch/exaClient.ts` (used by gatherCitationsTool)
- Streaming: `app/api/chat/lib/` (traceLogger, tokenEconomics)
- Knowledge: `app/api/chat/lib/bioenergeticKnowledge.ts`

### Report-Specific
- Cognitive tool: `app/api/report/phase1/tools/thinkTool.ts` (extraction tracking, enrichment planning, completion verification)
- Citation tool: `app/api/report/phase1/tools/gatherCitations/` (purpose-built for citation gathering + curation)
- Streaming callbacks: `app/api/report/phase1/analyze/streamCallbacks.ts` (no caching)

## 7. Implementation Notes
- **Two-step pattern**: Submit (persist) → Analyze (stream 3-phase execution)
- **Single-session architecture**: All 3 phases execute in one streaming session for coherent context
- **Directive-driven paradigm**: Agent executes expert directives, not autonomous decisions
- **Tool composition**: Cognitive tool (think) + Per-item recommendation tools (Gemini Flash CSV enrichment) + Citation tool (Exa + Gemini Flash curation)
- **Per-item enrichment**: 8-15+ tool calls per report (once per directive item) using Gemini Flash
- **Citation gathering**: Single tool call with organized topics → comprehensive Exa search → intelligent curation → 40 citations returned
- **Discriminated unions**: Recommendation tools return `"specific" | "options"` enabling flexible matching flows
- **No caching in tools**: Report execution is single-shot with unique client data - caching provides no benefit
- **System prompt differentiates**: Directive-driven report with bounded agent autonomy vs chat's open-ended exploration
- **Real-time visibility**: Streaming progress (per-item tool status, citation gathering, report text)
- **Deterministic persistence**: Single source of truth - submission (with Dalton's notes) + final comprehensive report
- **Sub-agent isolation**: Recommendation tools are blind (only see requested item + context); citation curator sees only subsection citations
- **Authority hierarchy**: Dalton's notes (PRIMARY directives) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
- **Prompt philosophy**: Intent over prescription, schema handles contract, enabling agent autonomy within bounded context
- **Model selection**: Primary agent (Sonnet 4.5), Sub-agents (Gemini 2.5 Flash for speed + cost optimization)

## 8. Architecture Principles

### Cognitive Architecture
- **Primary agent** (Sonnet 4.5): Executor & Enricher orchestrating all 3 phases with full context and all tools
- **Recommendation sub-agents** (Gemini Flash): Specialized CSV lookup + enrichment - receive requested item, return match(es) with details
- **Citation curator** (Gemini Flash): Receives comprehensive search results, selects most relevant per subsection
- **Tools as cognitive extensions**: Each tool extends specific capability (think, per-item enrichment, citation gathering)
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
- **Evidence-based**: Citations support mechanisms (not validate directives)
- **Citation curation**: Comprehensive search (10 per topic) → intelligent selection (10 per subsection) → manageable output (~40 total)
- **Interconnected**: Final synthesis explains how assessment findings and interventions connect through bioenergetic principles
- **Actionable**: Client knows what to do next based on expert directives

Reading this document should give a new engineer full context on what the "reports" project does today, how data flows through the system, and the architectural principles guiding implementation.

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
- **Submissions:** 
  - **Production (Vercel):** Stored in Upstash Redis with key `phase1-submissions:<caseId>`
  - **Local Development:** Stored in `storage/phase1-submissions/<caseId>.json`
  - Contains raw inputs + metadata (`caseId`, timestamps).
  - Written immediately when the UI submits the form.
- **Results:**
  - **Production (Vercel):** Stored in Upstash Redis with key `phase1-results:<caseId>`
  - **Local Development:** Stored in `storage/phase1-results/<caseId>.json`
  - Contains Phase 1 analysis output (root-cause report) + metadata.
  - Written when Phase 1 agent completes analysis.
- **Identifiers:** `caseId` is returned to the UI and becomes the join key for later phases.
- **Storage Implementation:** Environment-aware - automatically uses Redis when `UPSTASH_REDIS_REST_URL` is present (production), falls back to filesystem when missing (local dev).

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
- Initiates generation via POST to analyze endpoint (blocks until complete).
- Simple loading state during generation (typically 2-3 minutes).
- No real-time progress updates - generation happens on backend, frontend waits for completion.
- After completion: Fetches complete report from result endpoint and displays markdown.
- **PDF Download:** Provides "Download PDF" button that triggers server-side PDF generation and browser download.

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

**`app/api/report/phase1/pdf/route.ts`** (PDF export endpoint)
- POST endpoint that generates professional PDF from stored markdown report.
- Accepts `{ caseId }` and loads report from storage.
- Converts markdown → HTML using unified pipeline (same plugins as frontend for consistency).
- Generates PDF via Puppeteer with print-optimized CSS (smart page breaks, professional typography).
- Returns PDF blob with download headers (`application/pdf`).
- Max duration: 60 seconds (~2-3s typical).

**`app/api/report/phase1/analyze/route.ts`** (Directive-driven three-phase generation endpoint)
- Accepts `{ caseId }` and loads submission from storage.
- **Initializes citationsBuffer and passes submission + buffer via asyncLocalStorage** for tool access (enables PDF bypass + citation buffer pattern).
- Builds system prompt with bioenergetic knowledge + interpretation guides + client data + **Dalton's final notes** + PDF indicator.
- Runs agent (Sonnet 4.5) with `generateText` and 6 tools:
  - **Report-specific cognitive tool:** `reportThinkTool`
  - **Lab analysis tool (one-shot):** `analyzeExistingLabsTool` - Sonnet 4.5 sub-agent with multimodal PDF injection
  - **Recommendation tools (per-item enrichment):** `recommendDiagnosticsTool`, `recommendDietLifestyleTool`, `recommendSupplementsTool` - Gemini Flash sub-agents
  - **Citation tool:** `gatherCitationsTool` - Stores formatted citations in buffer, returns minimal acknowledgment
- Uses report-specific callbacks via `createReportCallbacks` (step logging only, finalization in route).
- Blocks until generation completes (no streaming).
- Executes full 3-phase workflow:
  - **Phase 1:** Extract directives from Dalton's/Advisor notes; parse questionnaire/takehome data
  - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool ONCE (comprehensive analysis) → map data to guide implications → enrich each directive item via per-item tool calls (8-15+) → organize citation needs and call gatherCitationsTool once (tool stores formatted citations in buffer, returns acknowledgment only)
  - **Phase 3:** Agent generates report body only (Introduction → Conclusion) - does NOT include Scientific References section
- **Backend assembly:** Concatenates agent output (report body) + citationsBuffer (formatted Scientific References section).
- Saves complete report to `storage/phase1-results/<caseId>.json`.
- Returns JSON response with success status and metadata.
- Max duration: 30 minutes.

**`app/api/report/phase1/analyze/systemPrompt.ts`**
- Loads interpretation guides from `data/` directory (questionnaire.md, takehome.md).
- Builds directive-driven 3-phase system prompt:
  - Prism context and bioenergetic knowledge framework
  - Interpretation guides (questionnaire + takehome)
  - Client data (questionnaire responses, takehome assessment, advisor notes, **Dalton's final notes**, `<previous_labs_uploaded>` indicator if PDFs present)
  - **Agent role:** Executor & Enricher (not decision-maker)
  - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
  - Phase 1: Extract directives; parse questionnaire/takehome against guides
  - Phase 2: If PDFs uploaded: call analyzeExistingLabsTool ONCE (comprehensive analysis); map to guide implications; enrich directives with per-item tool calls; organize citation needs with pattern summaries and entities, call gatherCitationsTool ONCE
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

**`app/api/report/phase1/tools/gatherCitations/`** (Citation gathering + curation tool with query optimization)
- **Purpose:** Generate optimized queries, gather and curate academic citations to support report content
- **Flow:**
  1. Receives citation requests with pattern summaries and entities (e.g., 12 patterns across 4 subsections)
  2. **Generates optimized queries** via **Gemini 2.5 Flash** sub-agent (2-4 queries per pattern, ~36 total)
  3. Executes parallel Exa neural searches (12 concurrent, 5 results per query, `category: "research paper"`)
  4. Groups results by subsection/pattern and deduplicates URLs
  5. **Curates intelligently** via **Gemini 2.5 Flash** sub-agent (selects up to 6 most relevant per pattern)
  6. Formats into hierarchical markdown and stores in buffer
- **Files:**
  - `tool.ts` - Tool definition with streaming status
  - `executor.ts` - 8-step orchestration: generate queries → flatten → search → group → deduplicate → curate → format → buffer
  - `curator.ts` - Gemini Flash sub-agent for relevance-based selection
  - `schema.ts` - Input (summary + entities per pattern), Output (acknowledgment)
  - `constants.ts` - Config (RESULTS_PER_QUERY=5, MAX_CITATIONS_PER_SUBSUBSECTION=6, concurrency=12)
  - `queryGeneration/` - Query optimization sub-agent (agent.ts, schema.ts, prompt.ts, types.ts)
- **Execution:** ~6-7 seconds total (2s query generation + 3s gathering + 2s curation)
- **Context preservation:** Agent provides summaries, receives acknowledgment only
- **Output:** Hierarchical References with subsections (###) and patterns (####)

**`app/api/report/phase1/pdf/lib/`** (PDF generation libraries)
- `markdownToHtml.ts` - Converts markdown to HTML using unified pipeline (remark-parse → remark-gfm → remark-rehype → rehype-stringify)
- `generatePdf.ts` - Generates PDF from HTML using Puppeteer (launches browser, renders, returns PDF buffer)
- `pdfStyles.ts` - Print-optimized CSS adapted from globals.css (professional typography, smart page breaks, table formatting)

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
- **Storage:** Uses Upstash Redis in production (when `UPSTASH_REDIS_REST_URL` env var present), filesystem fallback for local development.
- **Redis keys:** `phase1-submissions:<caseId>`

**`server/phase1Results.ts`**
- Persists Phase 1 analysis results and exposes `getPhase1Result` to retrieve by `caseId`.
- **Storage:** Uses Upstash Redis in production (when `UPSTASH_REDIS_REST_URL` env var present), filesystem fallback for local development.
- **Redis keys:** `phase1-results:<caseId>`

## 4. What Happens Today (End-to-End Flow)
1. User completes the Phase 1 form with **4 required fields** (questionnaire, takehome, advisor notes, **Dalton's final notes**) + **optional lab PDFs** (up to 5) and submits.
2. Frontend converts PDFs to base64 → POSTs to backend with text + PDF data.
3. Backend stores complete submission (text + base64 PDFs) and returns `caseId`.
4. Frontend navigates to `/report/analysis/<caseId>`.
5. Analysis page checks for existing result:
   - **If exists:** Loads cached report from storage (instant display, no re-run)
   - **If not found:** Initiates streaming agent by calling `/api/report/phase1/analyze`
6. Agent loads submission + citationsBuffer (passed via asyncLocalStorage), builds directive-driven 3-phase system prompt, and executes:
   - **Phase 1:** Extract directives from Dalton's/Advisor notes → parse questionnaire/takehome data → flag items ≥2 against interpretation guides
   - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool ONCE (Sonnet 4.5 analyzes all PDFs via multimodal injection, returns structured findings) → map flagged items to guide implications → enrich each directive item via per-item tool calls (8-15+) → organize citation topics and call gatherCitationsTool once (tool stores formatted citations in buffer, returns minimal acknowledgment)
   - **Phase 3:** Agent generates report body only (Introduction → Conclusion) - does NOT include Scientific References section (appended by backend)
7. Generation completes (blocks until done, typically 2-3 minutes).
8. Backend concatenates agent output (report body) + citationsBuffer (formatted Scientific References section).
9. Final comprehensive report saved to storage with complete markdown (body + citations).
10. Frontend receives completion, fetches complete report, displays with Existing Lab Results table (if PDFs) + Scientific References section.
11. On page refresh: Cached result loads instantly from storage (no re-analysis).
12. **PDF Export (optional):** User clicks "Download PDF" button → Frontend POSTs to `/api/report/phase1/pdf` → Backend converts markdown to HTML (unified) → generates PDF (Puppeteer) → returns PDF blob → browser downloads file.

Storage:
- **Production:** Upstash Redis (keys: `phase1-submissions:<caseId>`, `phase1-results:<caseId>`)
- **Local Dev:** Filesystem (`storage/phase1-submissions/<caseId>.json`, `storage/phase1-results/<caseId>.json`)

## 5. Current Status & Next Steps

### ✅ Completed (Directive-Driven Paradigm Refactor)
1. **Full 3-Phase Directive-Driven Pipeline** - Implemented with generateText (single awaitable execution)
   - Phase 1: Directive extraction + data parsing against interpretation guides
   - Phase 2: Guide implication mapping + per-item directive enrichment (8-15+ tool calls) + citation gathering (stores in buffer)
   - Phase 3: Agent generates report body only; backend concatenates with citations from buffer
   - **Status:** Optimized with citation buffer pattern for ~5,000 token savings per report

2. **Per-Item Enrichment Tool Architecture** - Optimized with Gemini Flash
   - Discriminated union schemas (`"specific" | "options"`) for flexible matching
   - CSV database caching for performance
   - Sub-agents use **Gemini 2.5 Flash** with `generateObject` for fast, cost-effective structured lookup + personalization
   - Called once per directive item (not batch selection) - 8-15+ calls per report
   - Streaming tool status for UX visibility
   - **Performance:** ~0.5-1s per call (3-5x faster than Sonnet, 10-15x cheaper)
   - **Status:** All 3 recommendation tools migrated to Gemini Flash

3. **Citation Gathering Tool** - Purpose-built with intelligent curation + buffer storage
   - Comprehensive Exa neural search across topics (12 concurrent, 10 results per topic, ~280 total)
   - **Intelligent curation** via Gemini Flash sub-agent (selects 10 most relevant per subsection from ~70)
   - **Deterministic formatting** via pure code (not LLM) into academic markdown
   - **Buffer storage** - stores formatted citations in asyncLocalStorage buffer (hidden from agent)
   - Returns minimal acknowledgment to agent (`{ acknowledged: true, citationCount: 40 }`) - only ~100 tokens
   - Execution: ~5 seconds (3s gathering + 2s curation + <1s formatting)
   - **Token savings:** ~5,000 tokens per report (~$0.08) - agent never sees or writes citations
   - **Status:** Fully implemented with buffer pattern + backend concatenation

4. **Generation & Caching**
   - Backend generation with `generateText` (blocks until complete)
   - Simple frontend loading state during generation
   - Result caching prevents re-analysis on page refresh
   - Instant load from storage for existing results
   - **Status:** Simplified from streaming to awaitable generation pattern

5. **Prompt Design Philosophy**
   - Clear separation: Prompt = intent, Schema = contract
   - Data definitions (what each section IS)
   - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent (gaps only)
   - **Agent role:** Executor & Enricher (not decision-maker)
   - Non-prescriptive approach enabling agent autonomy within bounded context
   - **Status:** Applied consistently across all tools and sub-agents

6. **PDF Export with Prism Branding**
   - **Branded cover page:** Client name extraction + gradient background + transparent logo
   - **Section divider pages:** "Our Analysis" and "Our Recommendations" full-page dividers with gradients
   - **Prism color scheme:** Red headings (#FF0C01), orange table borders (#F37521), orange gradient backgrounds
   - **Pipeline:** Markdown processing → section extraction → HTML conversion → template assembly → PDF generation
   - **Components:**
     - `markdownProcessor.ts` - Extracts client name and identifies section boundaries
     - `templateBuilder.ts` - Builds HTML with cover page, dividers, and styled content sections
     - `pdfStyles.ts` - Print-optimized CSS with Prism brand colors and fixed page dimensions
     - `generatePdf.ts` - Puppeteer-based PDF generation
   - **Page structure:** Cover → "Our Analysis" divider → Introduction/Assessment → "Our Recommendations" divider → Recommendations/Conclusion/References
   - Print-optimized with fixed heights (9.5in) for single-page rendering
   - Consistent markdown parsing with frontend (same unified plugins)
   - **Performance:** ~2-3s per PDF generation
   - **Status:** Fully implemented with branded styling and download button in analysis view

## 6. Key Files & Entry Points

### Frontend
- Form: `app/report/page.tsx` → `app/report/phase1-form.tsx`
- Analysis: `app/report/analysis/[caseId]/page.tsx` → `report-analysis-stream.tsx`

### Backend
- Submit API: `app/api/report/phase1/route.ts`
- Result retrieval API: `app/api/report/phase1/result/route.ts`
- PDF export API: `app/api/report/phase1/pdf/route.ts`
- PDF generation libs: `app/api/report/phase1/pdf/lib/` (markdownProcessor, templateBuilder, markdownToHtml, generatePdf, pdfStyles)
- PDF assets: `app/api/report/phase1/pdf/lib/prism_transparent.png` (logo with transparent background)
- Analyze API (3-phase): `app/api/report/phase1/analyze/route.ts`
- System prompt (3-phase): `app/api/report/phase1/analyze/systemPrompt.ts`
- Recommendation tools: `app/api/report/phase1/tools/` (3 Gemini Flash sub-agent tools)
- Citation tool: `app/api/report/phase1/tools/gatherCitations/` (Exa + Gemini Flash curation)
- Data: `app/api/report/phase1/data/` (interpretation guides + CSV databases)

### Shared/Server
- Schema: `lib/schemas/phase1.ts`
- Persistence: `server/phase1Cases.ts`, `server/phase1Results.ts`
  - **Storage:** Environment-aware (Upstash Redis in production, filesystem in local dev)
  - **Redis keys:** `phase1-submissions:<caseId>`, `phase1-results:<caseId>`
  - **Local filesystem:** `storage/phase1-submissions/`, `storage/phase1-results/`

### Reused from Chat
- Exa client: `app/api/chat/tools/researchOrchestratorTool/exaSearch/exaClient.ts` (used by gatherCitationsTool)
- Streaming: `app/api/chat/lib/` (traceLogger, tokenEconomics)
- Knowledge: `app/api/chat/lib/bioenergeticKnowledge.ts`

### Report-Specific
- Cognitive tool: `app/api/report/phase1/tools/thinkTool.ts` (extraction tracking, enrichment planning, completion verification)
- Citation tool: `app/api/report/phase1/tools/gatherCitations/` (purpose-built for citation gathering + curation + buffer storage)
- Callbacks: `app/api/report/phase1/analyze/streamCallbacks.ts` (step logging only, renamed from streaming-specific)

## 7. Implementation Notes
- **Two-step pattern**: Submit (persist) → Analyze (generate with await)
- **Single-session architecture**: All 3 phases execute in one generation call with generateText
- **Directive-driven paradigm**: Agent executes expert directives, not autonomous decisions
- **Environment-aware storage**: Production uses Upstash Redis (persistent, serverless-compatible), local dev uses filesystem (automatic fallback when Redis env vars missing)
- **Tool composition**: Cognitive tool (think) + Per-item recommendation tools (Gemini Flash CSV enrichment) + Citation tool (Exa + Gemini Flash curation + buffer storage)
- **Per-item enrichment**: 8-15+ tool calls per report (once per directive item) using Gemini Flash
- **Citation workflow**: Single tool call → comprehensive Exa search → intelligent curation → deterministic formatting → buffer storage → backend concatenation
- **Citation buffer pattern**: Tool stores formatted citations in asyncLocalStorage buffer, returns minimal acknowledgment (~100 tokens), backend concatenates after generation (~5,000 token savings)
- **Discriminated unions**: Recommendation tools return `"specific" | "options"` enabling flexible matching flows
- **No caching in tools**: Report execution is single-shot with unique client data - caching provides no benefit
- **System prompt differentiates**: Directive-driven report with bounded agent autonomy vs chat's open-ended exploration
- **Simple loading state**: Frontend shows loading during generation, fetches complete report when done (no real-time progress)
- **Deterministic persistence**: Single source of truth - submission (with Dalton's notes) + final comprehensive report
- **Sub-agent isolation**: Recommendation tools are blind (only see requested item + context); citation curator sees only subsection citations
- **Authority hierarchy**: Dalton's notes (PRIMARY directives) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
- **Prompt philosophy**: Intent over prescription, schema handles contract, enabling agent autonomy within bounded context
- **Model selection**: Primary agent (Sonnet 4.5), Sub-agents (Gemini 2.5 Flash for speed + cost optimization)
- **PDF export**: Server-side generation with branded templates - markdown processing → section extraction → HTML template assembly with cover/divider pages → Puppeteer PDF generation with Prism styling (red headings, orange tables, gradient backgrounds); reuses frontend markdown parsing for consistency
- **Frontend styling**: Report markdown displays with Prism colors via `variant="report"` prop on Response component and global CSS classes

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

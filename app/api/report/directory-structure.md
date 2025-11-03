# app/api/report Directory Structure

```
app/api/report/
└── phase1/
    ├── route.ts              # Submit endpoint: ingests submission (text + base64 PDFs), returns caseId
    ├── result/
    │   └── route.ts          # Result retrieval endpoint: returns cached analysis by caseId
    ├── pdf/
    │   ├── route.ts          # PDF export endpoint: converts markdown to PDF and returns download
    │   └── lib/
    │       ├── markdownToHtml.ts  # Converts markdown to HTML using unified pipeline
    │       ├── generatePdf.ts     # Generates PDF from HTML using Puppeteer
    │       └── pdfStyles.ts       # Print-optimized CSS for professional PDF output
    ├── analyze/
    │   ├── route.ts          # Three-phase generation endpoint using generateText (passes submission + citationsBuffer via asyncLocalStorage)
    │   ├── systemPrompt.ts   # Builds 3-phase system prompt with context + interpretation guides
    │   └── streamCallbacks.ts # Report-specific callbacks for step logging (renamed, no longer streaming-specific)
    ├── lib/
    │   └── asyncContext.ts   # Helper to access submission from asyncLocalStorage
    ├── tools/                # Report-specific tools
    │   ├── thinkTool.ts      # Reasoning, capturing findings, and tracking across phases
    │   ├── analyzeExistingLabs/
    │   │   ├── tool.ts       # Tool definition with logging and streaming status
    │   │   ├── agent.ts      # Sonnet 4.5 sub-agent with multimodal PDF injection + CSV
    │   │   └── schema.ts     # Input/output schemas (clientProfile → findings array)
    │   ├── recommendDiagnostics/
    │   │   ├── tool.ts       # Tool definition with logging
    │   │   ├── agent.ts      # Sub-agent invocation with CSV loading (Gemini Flash)
    │   │   └── schema.ts     # Input/output schemas with constraints
    │   ├── recommendDietLifestyle/
    │   │   ├── tool.ts
    │   │   ├── agent.ts      # Gemini Flash sub-agent
    │   │   └── schema.ts
    │   ├── recommendSupplements/
    │   │   ├── tool.ts
    │   │   ├── agent.ts      # Gemini Flash sub-agent
    │   │   └── schema.ts
    │   └── gatherCitations/
    │       ├── tool.ts       # Tool definition
    │       ├── executor.ts   # 8-step orchestration: query generation → search → curation
    │       ├── curator.ts    # Gemini Flash curation sub-agent
    │       ├── schema.ts     # Input/output schemas
    │       ├── constants.ts  # Configuration (results per query, max citations, etc.)
    │       └── queryGeneration/
    │           ├── agent.ts    # Gemini Flash query optimization sub-agent
    │           ├── schema.ts   # Query generation input/output schemas
    │           ├── prompt.ts   # Bioenergetic query optimization prompt
    │           └── types.ts    # TypeScript interfaces
    └── data/
        ├── questionaire.md   # Questionnaire interpretation guide (PRIMARY for Phase 1)
        ├── takehome.md       # Take-home test interpretation guide (PRIMARY for Phase 1)
        ├── Prsim Data - Diagnostics_implications.csv       # Used by recommendDiagnosticsTool AND analyzeExistingLabsTool
        ├── Prsim Data - Diet & Lifestyle.csv               # Used by recommendDietLifestyleTool
        └── Prsim Data - Supplements & Pharmaceuticals.csv  # Used by recommendSupplementsTool
```

## Files

### Submission Flow
- `phase1/route.ts`
  - Accepts Phase 1 submission payloads: 4 text fields + optional lab PDFs (base64-encoded).
  - Validates with `phase1SubmissionSchema` (includes `labPdfs` array with filename, data, mediaType).
  - Persists complete submission (text + PDF data) via `upsertPhase1Case()`:
    - **Production:** Upstash Redis (key: `phase1-submissions:<caseId>`)
    - **Local Dev:** Filesystem (`storage/phase1-submissions/<caseId>.json`)
  - Returns `{ caseId }` to frontend.

### Result Retrieval
- `phase1/result/route.ts`
  - GET endpoint accepting `caseId` query parameter.
  - Retrieves existing analysis result via `getPhase1Result(caseId)`.
  - Returns `{ report, createdAt }` if found (200), or 404 if not found.
  - Used by frontend to check for cached results before initiating new analysis.

### PDF Export
- `phase1/pdf/route.ts`
  - POST endpoint accepting `{ caseId }` in request body.
  - Loads report markdown from storage via `getPhase1Result(caseId)`.
  - Converts markdown → HTML using `markdownToHtml()` (unified pipeline with same plugins as frontend).
  - Generates PDF using `generatePdf()` (Puppeteer with print-optimized CSS).
  - Returns PDF blob with download headers (`application/pdf`, `Content-Disposition: attachment`).
  - Max duration: 60 seconds (~2-3s typical).

- `phase1/pdf/lib/markdownToHtml.ts`
  - Uses unified pipeline: remark-parse → remark-gfm → remark-rehype → rehype-stringify.
  - Same plugins as frontend Streamdown component ensures consistent rendering.
  - Returns HTML string ready for PDF generation.

- `phase1/pdf/lib/generatePdf.ts`
  - Launches headless Puppeteer browser.
  - Embeds HTML content with PDF-optimized styles.
  - Generates PDF with professional settings (Letter format, proper margins).
  - Returns PDF as Uint8Array buffer.

- `phase1/pdf/lib/pdfStyles.ts`
  - Print-optimized CSS adapted from `globals.css` Streamdown styles.
  - Professional typography: serif fonts, proper spacing, justified text.
  - Smart page breaks: sections (H2) start new pages, tables/items never split.
  - Static colors (no CSS variables for PDF compatibility).

### Analysis Flow (Directive-Driven Three-Phase Pipeline)
- `phase1/analyze/route.ts`
  - Directive-driven three-phase generation endpoint (POST with `{ caseId }`).
  - Loads submission from storage via `getPhase1Case(caseId)`.
  - **Initializes citationsBuffer and passes submission + buffer via asyncLocalStorage** for tool access (enables PDF bypass + citation buffer pattern).
  - Builds directive-driven 3-phase system prompt with `buildPhase1SystemPrompt(submission)`.
  - Runs agent (Sonnet 4.5) with `generateText` and 6 tools:
    - **Report-specific cognitive tool:**
      - `reportThinkTool` - extraction tracking, enrichment planning, completion verification
    - **Lab analysis tool (Gemini 2.5 Flash sub-agent with multimodal PDF injection):**
      - `analyzeExistingLabsTool` - Accesses PDFs via asyncLocalStorage, parses with Gemini 2.5 Flash + Diagnostics CSV, returns structured findings for Assessment Findings table
    - **Recommendation tools (per-item enrichment, Gemini Flash sub-agents):**
      - `recommendDiagnosticsTool` - CSV lookup + enrichment per directive item
      - `recommendDietLifestyleTool` - CSV lookup + enrichment per directive item
      - `recommendSupplementsTool` - CSV lookup + enrichment per directive item
    - **Citation tool:**
      - `gatherCitationsTool` - Parallel Exa search + Gemini Flash curation, stores formatted citations in buffer, returns minimal acknowledgment
  - Reuses infrastructure from chat route:
    - `TraceLogger` + `asyncLocalStorage` (logging and context)
    - `TokenEconomics` (cost tracking)
  - Uses report-specific callbacks:
    - `createReportCallbacks` (step logging via onStepFinish, prepareStep)
  - Blocks until generation completes (no streaming).
  - Executes full 3-phase workflow:
    - **Phase 1:** Extract directives from Dalton's/Advisor notes; parse questionnaire/takehome against interpretation guides
    - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool once (comprehensive analysis); map data to guide implications; enrich directives via per-item tool calls (8-15+); organize citation topics by subsection; call gatherCitationsTool once (tool stores formatted citations in buffer, returns acknowledgment only)
    - **Phase 3:** Agent generates report body (Introduction → Conclusion); backend concatenates body + citations from buffer
  - **Backend assembly:** Concatenates agent output (report body) + citationsBuffer (formatted Scientific References section).
  - Saves final comprehensive report via `savePhase1Result()`:
    - **Production:** Upstash Redis (key: `phase1-results:<caseId>`)
    - **Local Dev:** Filesystem (`storage/phase1-results/<caseId>.json`)
  - Returns JSON response with success status and metadata (connection may close before response delivered, but function continues and saves result).
  - Max duration: 13.33 minutes (800s Vercel limit).

- `phase1/analyze/systemPrompt.ts`
  - Loads interpretation guides from `data/` directory (cached after first load).
  - Builds directive-driven 3-phase system prompt:
    - Prism context (what company, what you're generating)
    - Bioenergetic knowledge framework (from `@/app/api/chat/lib/bioenergeticKnowledge`)
    - `<interpretation_guides>` (questionnaire.md + takehome.md)
    - `<client_data>` (questionnaire responses, takehome assessment, advisor notes, **Dalton's final notes**, `<previous_labs_uploaded>` indicator if PDFs present)
    - **Agent role:** Executor & Enricher (not decision-maker)
    - **Authority hierarchy:** Dalton's notes (PRIMARY) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
    - **Phase 1:** Extract directives from notes; parse questionnaire/takehome against guides (use thinkTool for tracking)
    - **Phase 2:** If PDFs uploaded: call analyzeExistingLabsTool once; map to guide implications; enrich directives via per-item tool calls; organize citation topics and call gatherCitationsTool (receives acknowledgment only)
    - **Phase 3:** Generate report body (Introduction → Conclusion); do NOT include Scientific References section (appended automatically by backend)
  - Returns array of message objects for `generateText`.
  - **Prompt philosophy:** Intent over prescription, data clarity, enabling autonomy within bounded context

### Report-Specific Cognitive Tool
- `phase1/tools/thinkTool.ts`
  - **Description:** Tracking space for extraction results, enrichment planning, and completion verification
  - **Schema:** Single `thought` parameter for structured tracking/reasoning
  - **Pattern:** Follows Anthropic's design where thinkTool serves both reasoning and memory purposes
  - **Usage:** Agent uses for capturing parsed directives, noting ambiguities, tracking pending tool calls, verifying operations complete before proceeding

- `phase1/analyze/streamCallbacks.ts`
  - **Purpose:** Report-specific callbacks for step logging (no longer streaming-specific, name retained for minimal diff)
  - **Callbacks:** `onStepFinish` (step logging, planning thought capture) and `prepareStep` (returns messages as-is)
  - **Removed:** `onFinish`, `onError`, `onAbort` (finalization logic moved to route.ts after generateText completes)
  - **Rationale:** Report execution is single-shot with unique client data per case - no caching, simplified finalization

### Lab Analysis Tool (Existing Lab Results - Comprehensive One-Shot Analysis)
- `phase1/tools/analyzeExistingLabs/`
  - **tool.ts:** Tool definition with streaming status emissions ("Analyzing uploaded lab results...")
  - **agent.ts:** Loads `Diagnostics_implications.csv` (cached), accesses PDFs via `getSubmission()` from asyncLocalStorage, invokes **Gemini 2.5 Flash** sub-agent with multimodal message (text + CSV + PDF files)
  - **schema.ts:** Input (clientProfile + analysisObjective), Output (findings array with test/result/assessment/implication + optional synthesis)
  - **Sub-agent prompt:** Intent-focused (extract from PDFs + match against CSV + assess using Prism's Ranges + bioenergetic reasoning), includes explicit instruction to INCLUDE Prism's Range values in assessment field when available
  - **Token logging:** Logs inputTokens, outputTokens, totalTokens for visibility into PDF processing cost

**Key principles:**
- **One-shot pattern:** Called ONCE per report to analyze ALL uploaded lab PDFs comprehensively (not per-item like recommendation tools)
- **Context bypass:** PDFs accessed via asyncLocalStorage, not passed through primary agent's context (preserves context economy)
- **Gemini 2.5 Flash model:** Reliable multimodal document analysis with native structured output (100% success rate, avoids Anthropic SDK schema serialization bug)
- **Multimodal:** Directly injects PDF data into sub-agent alongside prompt and CSV database
- **Optional assessment field:** Handles tests with and without Prism's Ranges (discriminated at field level)
- **Placement:** Results integrated into Assessment Findings section as "Existing Lab Results" table before Recommendations
- **Execution:** ~5-10 seconds depending on PDF complexity and number of tests extracted

### Recommendation Tools (Per-Item Enrichment Sub-Agents)
- `phase1/tools/recommendDiagnostics/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diagnostics_implications.csv` (cached), invokes **Gemini Flash** sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Intent-focused (lookup + enrich), no schema overlap, enables autonomy

- `phase1/tools/recommendDietLifestyle/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Diet & Lifestyle.csv` (cached), invokes **Gemini Flash** sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Intent-focused (lookup + enrich), no schema overlap, enables autonomy

- `phase1/tools/recommendSupplements/`
  - **tool.ts:** Tool definition with streaming status emissions
  - **agent.ts:** Loads `Supplements & Pharmaceuticals.csv` (cached), invokes **Gemini Flash** sub-agent with `generateObject`
  - **schema.ts:** Input schema (requestedItem + client context + objective), Output schema (discriminated union: specific vs options)
  - **Sub-agent prompt:** Intent-focused (lookup + enrich), no schema overlap, enables autonomy

**Key principles:**
- **Per-item pattern:** Called once per directive item (8-15+ calls per report)
- **Discriminated unions:** Returns `type: "specific"` (single match) or `type: "options"` (2-5 matches for ambiguous requests)
- **Gemini Flash model:** Fast, cost-effective for structured CSV lookup + personalization tasks
- Sub-agents are blind (no research tools, no memory, only see requested item + context)
- CSV database is PRIMARY authority for each tool
- Structured output via `generateObject` ensures type safety
- Primary agent provides comprehensive context and orchestrates vague → specific flow

### Data
- `phase1/data/questionaire.md`
  - Maps questionnaire questions to bioenergetic implications.
  - PRIMARY authority for Phase 1 root cause identification.

- `phase1/data/takehome.md`
  - Maps take-home tests to interpretations.
  - PRIMARY authority for Phase 1 root cause identification.

- `phase1/data/Prsim Data - Diagnostics_implications.csv`
  - Diagnostic tests database (242 entries).
  - Used by recommendDiagnosticsTool (per-item enrichment) AND analyzeExistingLabsTool (existing lab analysis) in Phase 2.
  - Columns: Diagnostic, Implication, (empty), Prism's Ranges, Where to get

- `phase1/data/Prsim Data - Diet & Lifestyle.csv`
  - Diet and lifestyle interventions database (138 entries).
  - Used by recommendDietLifestyleTool in Phase 2.

- `phase1/data/Prsim Data - Supplements & Pharmaceuticals.csv`
  - Supplements and pharmaceuticals database (334 entries).
  - Used by recommendSupplementsTool in Phase 2.

### Citation Tool (Query Optimization + Gathering + Curation + Buffer Storage)
- `phase1/tools/gatherCitations/`
  - **tool.ts:** Tool definition (call ONCE with ALL patterns)
  - **executor.ts:** Orchestrates 8-step process:
    1. **Generate optimized queries** via Gemini Flash sub-agent (2-4 queries per pattern)
    2. Flatten generated queries into search tasks
    3. Execute parallel Exa neural searches (12 concurrent, 5 results per query, `category: "research paper"`)
    4. Group results by subsection and pattern
    5. Deduplicate via URL canonicalization
    6. Curate per pattern (up to 6 citations via Gemini Flash curator)
    7. **Format citations into hierarchical markdown** (deterministic code) and **store in citationsBuffer**
    8. Return minimal acknowledgment
  - **curator.ts:** Gemini Flash sub-agent for relevance-based citation selection
  - **schema.ts:** Input (summary + entities per pattern), Output (minimal acknowledgment)
  - **constants.ts:** Configuration (RESULTS_PER_QUERY=5, MAX_CITATIONS_PER_SUBSUBSECTION=6, concurrency=12)
  - **queryGeneration/:** Query optimization sub-agent (agent.ts, schema.ts, prompt.ts, types.ts)

**Citation workflow (buffer pattern with query optimization):**
- Agent provides pattern summaries and key entities (e.g., 12 patterns across 4 subsections)
- Tool generates optimized neural queries (~36 queries from 12 patterns)
- Tool gathers comprehensively (36 queries × 5 = 180 citations)
- Tool curates intelligently (12 patterns × up to 6 = ~72 citations)
- Tool formats into hierarchical markdown (### subsection, #### pattern)
- **Tool stores formatted markdown in citationsBuffer** (hidden from agent context)
- **Agent receives minimal acknowledgment** - only ~100 tokens
- Backend concatenates agent output + citationsBuffer after generation completes
- **Total time:** ~6-7 seconds (2s query gen + 3s gathering + 2s curation)
- **Token savings:** ~5,000 tokens per report - agent never sees or writes citations

## Related Modules
- `server/phase1Cases.ts` – Submission persistence (`upsertPhase1Case`, `getPhase1Case`). Uses Upstash Redis in production, filesystem in local dev.
- `server/phase1Results.ts` – Result persistence (`savePhase1Result`, `getPhase1Result`). Uses Upstash Redis in production, filesystem in local dev.
- `lib/schemas/phase1.ts` – Shared Zod schema and constants for submissions (includes `labPdfs` with base64 PDF data).
- `app/api/report/phase1/lib/asyncContext.ts` – Helper to access submission from asyncLocalStorage (enables PDF bypass pattern).
- `app/api/report/phase1/tools/` – Report-specific tools (thinkTool, analyzeExistingLabs, recommendations, gatherCitations).
- `app/api/report/phase1/analyze/streamCallbacks.ts` – Report-specific streaming callbacks (no caching).
- `app/api/chat/tools/researchOrchestratorTool/exaSearch/` – Exa client reused for citation searches.
- `app/api/chat/lib/` – Streaming infrastructure reused (TraceLogger with extended AsyncContext, TokenEconomics).
- `app/api/chat/lib/bioenergeticKnowledge.ts` – Bioenergetic framework used in all prompts.
- `docs/agentic-progress.md` – Streaming progress patterns reference.
- `docs/report_proj_overview.md` – Complete project overview and architecture principles.

## Architecture Summary

**Single-session directive-driven 3-phase pipeline:**
1. **Phase 1:** Primary agent (Sonnet 4.5) extracts directives from Dalton's/Advisor notes → parses questionnaire/takehome data → flags items ≥2 against interpretation guides
2. **Phase 2:** Primary agent detects if PDFs uploaded → if yes: calls analyzeExistingLabsTool ONCE (Sonnet 4.5 sub-agent with multimodal PDF injection) → receives structured findings → maps flagged items to guide implications → calls per-item enrichment tools 8-15+ times (Gemini Flash sub-agents) → receives CSV-matched details (specific or options) → organizes citation topics by subsection → calls gatherCitationsTool once (tool stores formatted citations in buffer, returns acknowledgment only)
3. **Phase 3:** Primary agent generates report body only (Introduction → Conclusion) → backend concatenates body + citations from buffer → saves complete report

**Key architectural principles:**
- **Directive-driven:** Human expertise (Dalton/Advisor) directs interventions; agent executes and enriches
- **Cognitive hierarchy:** Primary agent (Sonnet 4.5: Executor & Enricher) → Sub-agents (Sonnet 4.5 for labs, Gemini Flash for recommendations/curation)
- **Authority hierarchy:** Dalton's notes (PRIMARY directives) > Advisor notes (SECONDARY) > Guides (mapping) > Agent reasoning (gaps only)
- **PDF bypass pattern:** Lab PDFs accessed via asyncLocalStorage (not through primary agent context) → multimodal injection into sub-agent → preserves context economy
- **Citation buffer pattern:** Tool formats citations → stores in asyncLocalStorage buffer → returns minimal acknowledgment → backend concatenates after generation → ~5,000 token savings per report
- **One-shot lab analysis:** analyzeExistingLabsTool called ONCE to analyze ALL PDFs comprehensively (vs per-item pattern for recommendations)
- **Per-item enrichment:** Recommendation tools called once per directive item (not batch selection)
- **Citation workflow:** Comprehensive gathering (280) → Intelligent curation (40) → Deterministic formatting → Buffer storage → Backend assembly
- **Discriminated unions:** Clear contract for specific vs ambiguous matches enabling flexible orchestration
- **Prompt philosophy:** Intent over prescription, schema defines contract, enable autonomy within bounded context
- **Model selection:** Sonnet 4.5 for orchestration/reasoning + medical analysis, Gemini Flash for structured lookup/curation tasks
- **Generation pattern:** `generateText` with await → JSON response (no streaming) → simple frontend loading state


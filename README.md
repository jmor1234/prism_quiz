# PRISM Report Augmentation and Automation System

**AI-powered execution engine that scales expert healthcare decisions through intelligent knowledge translation.**

> 🔒 **Note:** This is a public repository with all client-specific data removed. Production system actively serving [Prism Therapeutics](https://prism.miami/) clients.

**Prism Therapeutics:** [@Outdoctrination on X](https://x.com/Outdoctrination) · 120k followers · Premium alternative health care from a bioenergetic based approach.

---

## The Problem

Prism Therapeutics provides premium alternative healthcare services with comprehensive, evidence-based personalized reports for each client. Their process:

1. **Data Collection:** Questionnaires, take-home assessments, lab results, advisor consultations
2. **Expert Decision-Making:** Founder (Dalton) and Prism advisors review each case and determine optimal interventions
3. **Report Curation:** Manual curators translate expert decisions into comprehensive reports by:
   - Sifting through extensive Google Sheets and documents ("The Model" - years of research)
   - Looking up each recommendation in the knowledge base
   - Copy-pasting relevant data into a report template
   - Formatting and organizing the final document

**The Bottleneck:**
- **Time:** Hours per report
- **Cost:** $75 per report in labor
- **Limitations:** Descriptions in the final report we're not as contextual personalized as they could be
- **Scalability:** Time delay and cost as client base grows becoming less feasible.

The manual curators weren't making clinical decisions—they were executing a **knowledge translation process**. This is exactly what AI should handle.

---

## The Solution

An **AI executor agent** that translates expert decisions through Prism's knowledge base with enhanced personalization and scientific backing.

### Authority Model (Critical)

```
Dalton + Prism Advisors
         ↓
    [Make Clinical Decisions]
         ↓
    AI Executor Agent
         ↓
[Translate Through Knowledge Base + Add Personalization + Gather Evidence]
         ↓
  Comprehensive Report
```

**Humans make all clinical decisions. AI executes, enriches, and scales expertise.**

The agent operates on clear authority hierarchy:
1. **PRIMARY:** Dalton's clinical notes and directives
2. **SECONDARY:** Advisor recommendations
3. **TERTIARY:** Interpretation guides (mapping patterns)
4. **GAPS ONLY:** Agent reasoning for missing context

This ensures safety, trust, and regulatory compliance while leveraging AI for what it does best: rapid knowledge synthesis and personalization.

---

## The Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Time** | 1-3 hours | 6-10 minutes | **~95% reduction** |
| **Cost** | $75/report | ~$2-4/report | **~95% reduction** |
| **Quality** | very good but lacking full personalization | improved personalized and contextual relevance | **Enhanced capabilities** |

**Quality improvements:**
- ✅ Contextual personalization based on full client profile
- ✅ Comprehensive scientific citations with Exa-powered research
- ✅ Consistent formatting and structure
- ✅ Nuanced recommendations that manual process couldn't feasibly provide

---

## How It Works

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Form: Client data + Expert decisions + Lab PDFs → Submit       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Vercel + Upstash)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Three-Phase AI Pipeline                       │ │
│  │                                                            │ │
│  │  Phase 1: Extract Directives                              │ │
│  │    └─ Parse expert notes + client data                    │ │
│  │                                                            │ │
│  │  Phase 2: Enrich Through Knowledge Base                   │ │
│  │    ├─ Analyze lab PDFs (multimodal sub-agent)            │ │
│  │    ├─ Enrich recommendations (CSV lookup sub-agents)      │ │
│  │    └─ Gather scientific citations (Exa research tool)     │ │
│  │                                                            │ │
│  │  Phase 3: Synthesize Report                               │ │
│  │    └─ Generate comprehensive personalized report          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Storage: Upstash Redis (prod) / Filesystem (dev)               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Polling → Result Display → PDF Download                        │
└─────────────────────────────────────────────────────────────────┘
```

### UI Workflow

1. **Form Submission** (`/report`):
   - 4 required text fields: questionnaire, take-home assessment, advisor notes, Dalton's final notes
   - Optional: Upload previous lab results (up to 5 PDFs)
   - Validation + autosave to localStorage
   - Submit → Receive `caseId`

2. **Analysis Flow** (`/report/analysis/[caseId]`):
   - Check for existing cached result first
   - If not found: Fire off analysis (fire-and-forget POST)
   - Start polling every 10 seconds
   - Display loading state: "Generating report... (typically 6-12 minutes)"
   - When complete: Load and display markdown report

3. **Result Display**:
   - Prism-branded markdown rendering (red headings, orange tables)
   - Existing Lab Results table (if PDFs uploaded)
   - Scientific References section organized by subsection
   - "Download PDF" button → branded PDF with cover page and section dividers

### The Exa Citations Engine (Deep Dive)

The citations tool implements a sophisticated research pipeline that would be impossible for manual curators:

```
Agent identifies citation needs
         ↓
[Provides patterns by subsection]
         ↓
┌────────────────────────────────────────────────┐
│         Citations Tool (8-Step Process)        │
│                                                │
│  1. Query Optimization Sub-Agent               │
│     └─ Convert patterns → optimized Exa queries│
│        (12 patterns → 36 targeted queries)     │
│                                                │
│  2. Parallel Neural Search                     │
│     └─ Exa search across all queries           │
│        (36 queries × 5 results = 180 sources)  │
│                                                │
│  3. Intelligent Curation Sub-Agent             │
│     └─ Filter to most relevant sources         │
│        (180 sources → ~72 final citations)     │
│                                                │
│  4. Hierarchical Formatting                    │
│     └─ Organize by subsection + pattern        │
│                                                │
│  5. Buffer Storage                             │
│     └─ Store in asyncLocalStorage buffer       │
│        (Hidden from agent context)             │
│                                                │
│  6. Return Acknowledgment                      │
│     └─ Agent receives ~100 token confirmation  │
│        (Not 5,000+ tokens of citation data)    │
│                                                │
│  7. Backend Assembly                           │
│     └─ Concatenate report + citations buffer   │
└────────────────────────────────────────────────┘
```

**Key innovations:**
- **Query optimization:** Sub-agent converts research patterns into Exa-optimized neural search queries
- **Comprehensive gathering:** Parallel searches ensure broad coverage
- **Intelligent curation:** Sub-agent filters to highest-relevance sources only
- **Buffer pattern:** Citations formatted and stored outside agent context, then concatenated by backend
  - Agent never sees raw citation data (massive token savings)
  - Tool returns only acknowledgment
  - No impact on agent's context window

**Why this matters:** Manual curators couldn't feasibly provide scientific citations at this depth and quality. The AI adds a capability that significantly enhances report credibility and value.

### Cognitive Architecture

```
Primary Agent (Claude Sonnet 4.5)
     ↓ [Orchestration, reasoning]
     │
     ├─→ Lab Analysis Sub-Agent (Gemini 2.5 Flash)
     │   └─ Multimodal PDF analysis with diagnostic database
     │
     ├─→ Enrichment Sub-Agents (Gemini Flash)
     │   ├─ Diagnostic recommendations (CSV lookup + personalization)
     │   ├─ Diet & lifestyle recommendations
     │   └─ Supplement recommendations
     │
     └─→ Citation Research Sub-Agents (Gemini Flash)
         ├─ Query optimization (patterns → Exa queries)
         └─ Curation (relevance filtering)
```

**Why this hierarchy?**
- **Sonnet 4.5:** Complex reasoning, tool calling, orchestration
- **Gemini 2.5 Flash:** Multimodal document analysis (PDFs), reliable structured output
- **Gemini Flash:** Fast, cost-effective for structured lookup and curation tasks

Each layer handles what it's optimized for. Intelligence emerges from interaction patterns, not individual capabilities.

### Technical Stack

**Models:**
- Claude Sonnet 4.5 (primary agent, orchestration)
- Gemini 2.5 Flash (multimodal lab analysis)
- Gemini Flash (recommendation enrichment, citation curation)

**Tools & Infrastructure:**
- **AI SDK v5:** Unified provider interface with tool calling
- **Vercel:** Deployment platform (13.33 min max duration for analysis)
- **Upstash Redis:** Production storage for submissions and results
- **Puppeteer:** PDF generation with branded styling
- **Exa API:** Neural search for scientific citations
---

## What's Next

This report automation system serves as the foundation for Prism's next evolution: **a free-form chat agent** that clients can interact with directly.

**Same cognitive architecture, different mode:**
- **Report system = Execution mode** (directive-driven)
- **Chat agent = Exploration mode** (curiosity-driven)

Both leverage:
- Prism's knowledge base
- Client-specific data
- Comprehensive Exa research tools
- Bioenergetic framework

🔗 **Next project:** [Prism Research Engine](https://github.com/jmor1234/prism_research_engine) (currently in development)

---

## Repository Structure

```
prism_reports/
├── app/
│   ├── report/                      # Frontend form and analysis pages
│   │   ├── page.tsx                 # Main form entry
│   │   ├── phase1-form.tsx          # Data collection form
│   │   └── analysis/[caseId]/       # Result display and polling
│   └── api/
│       └── report/
│           └── phase1/              # Backend API endpoints
│               ├── route.ts         # Submission endpoint
│               ├── result/          # Result retrieval
│               ├── analyze/         # Three-phase generation
│               ├── pdf/             # PDF export
│               ├── tools/           # Report-specific tools
│               │   ├── thinkTool.ts
│               │   ├── analyzeExistingLabs/
│               │   ├── recommendDiagnostics/
│               │   ├── recommendDietLifestyle/
│               │   ├── recommendSupplements/
│               │   └── gatherCitations/
│               └── data/            # Knowledge base (CSV databases)
├── docs/                            # Architecture and implementation docs
├── PROJECT_OVERVIEW.md              # Core system philosophy
└── README.md                        # This file
```

For detailed technical documentation:
- `app/report/directory-structure.md` - Frontend architecture
- `app/api/report/directory-structure.md` - Backend architecture and tool design
- `docs/report_proj_overview.md` - Complete project overview

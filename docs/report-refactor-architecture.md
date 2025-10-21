# Report System Refactor: First Principles Architecture

## Executive Summary

This document outlines the complete transformation from an **analysis-driven** report system to a **directive-driven** report system. The fundamental shift: the AI agent moves from primary decision-maker to executor and enricher of human-provided directives.

---

## Part 1: The Fundamental Paradigm Shift

### Current Paradigm (Analysis-Driven)
```
Raw Data → Agent Analyzes → Agent Decides → Agent Generates Report
```

**Agent role:** Detective/Analyst
- Interprets questionnaire/takehome data using guides
- Identifies root causes through bioenergetic reasoning
- Selects interventions from databases based on analysis
- Validates with research throughout

**Authority hierarchy:**
1. Interpretation guides (PRIMARY for symptom→root cause mapping)
2. Agent's bioenergetic reasoning (DECISION MAKER)
3. Research tools (SECONDARY validation)

### New Paradigm (Directive-Driven)
```
Raw Data + Advisor Directives + Dalton's Directives → Agent Extracts & Maps → Agent Enriches & Personalizes → Agent Generates Report
```

**Agent role:** Executive Assistant/Enricher
- Executes directives from Dalton's/Advisor's notes
- Maps client flags (ratings ≥2) to interpretation guide implications
- Enriches directive items with database details + personalization
- Uses bioenergetic reasoning only for ambiguity/gaps

**Authority hierarchy:**
1. Dalton's Final Notes (MOST weight - PRIMARY directives)
2. Advisor Notes (SECOND most weight - FALLBACK directives)
3. Interpretation guides (PRIMARY for symptom→implication mapping)
4. Agent's bioenergetic reasoning (BOUNDED - only for ambiguity/gaps)
5. Research tools (ONLY for citations, not validation)

### Why This Shift?

**First principle:** Human expertise should drive clinical decisions; AI should execute and enrich those decisions at scale.

- **Current problem:** Agent makes clinical decisions autonomously
- **New solution:** Agent executes expert directives with intelligent enrichment
- **Benefit:** Combines human judgment with AI's ability to map, personalize, and cite at scale

---

## Part 2: Data Architecture Changes

### 2.1 New Input Field

**Add:** `daltonsFinalNotes` (required text field)

**Schema changes:**
```typescript
// lib/schemas/phase1.ts
export const phase1SubmissionSchema = z.object({
  questionnaireText: nonEmptyTrimmedString,
  takehomeText: nonEmptyTrimmedString,
  advisorNotesText: nonEmptyTrimmedString,
  daltonsFinalNotes: nonEmptyTrimmedString,  // NEW
  attachmentIds: phase1AttachmentIdsSchema,
});
```

**Frontend changes:**
- Add fourth textarea in `phase1-form.tsx`
- Add localStorage key for autosave
- Update form validation to require all 4 fields
- Same constraints as other fields (max 100k chars)

**Backend changes:**
- `Phase1Submission` type automatically updated via schema inference
- No changes needed to persistence layer (handles any valid schema)
- Add to system prompt injection (highest priority section)

### 2.2 Input Data Role Transformation

| Input | OLD Role | NEW Role |
|-------|----------|----------|
| `questionnaireText` | Evidence for agent analysis | Source for mapping to guide implications |
| `takehomeText` | Evidence for agent analysis | Source for mapping to guide implications |
| `advisorNotesText` | Context/guidance | SECONDARY directives (fallback) |
| `daltonsFinalNotes` | N/A | PRIMARY directives (most weight) |

**First principle:** Data's purpose changes based on who makes decisions. When humans decide, agent needs different operations on the same data.

---

## Part 3: Tool Architecture Transformation

### 3.1 Current Tool Pattern (Batch Selection)

**Current flow:**
```
Input: rootCauses[] + clientContext + objective
Process: Sub-agent analyzes CSV → Selects best 5-7 matches → Returns structured output
Output: { recommendations: [item1, item2, ...], .max(7) }
```

**Tool is called:** 1-3 times per report (once per category)

**Sub-agent role:** Selector/Analyzer

### 3.2 New Tool Pattern (Per-Item Enrichment)

**New flow:**
```
Input: requestedItem (specific or vague) + clientContext + objective
Process: Sub-agent looks up CSV → Matches item(s) → Enriches with personalization → Returns details
Output:
  - If specific: { recommendation: { name, rationale, dosage, source, category } }
  - If vague: { options: [opt1, opt2, opt3], .max(5) } → primary agent decides → recalls tool
```

**Tool is called:** 8-15+ times per report (once per directive item)

**Sub-agent role:** Lookup + Enricher

### 3.3 Why This Change?

**First principle:** Single Responsibility - a tool should do one thing well.

- **OLD:** Tool does selection + enrichment (complex, opaque)
- **NEW:** Tool does enrichment only (simple, composable)
- **Benefit:** Primary agent orchestrates all decisions, sub-agent focuses on detail retrieval

### 3.4 Schema Changes Required

**Diagnostic Tool Schema:**
```typescript
// Input schema
export const recommendDiagnosticsInputSchema = z.object({
  requestedItem: z.string().describe("Specific diagnostic name or category from directives"),
  clientContext: z.object({
    age: z.number().optional(),
    gender: z.string().optional(),
    primaryConcerns: z.array(z.string()),
    constraints: z.array(z.string()).optional(),
  }),
  objective: z.string().describe("Strategic guidance for this specific item"),
});

// Output schema (dual mode)
export const recommendDiagnosticsOutputSchema = z.object({
  result: z.discriminatedUnion("type", [
    // Specific match
    z.object({
      type: z.literal("specific"),
      recommendation: z.object({
        diagnostic: z.string(),
        rationale: z.string(),
        rootCauseAddressed: z.string(),
        whereToGet: z.string(),
      }),
    }),
    // Ambiguous matches
    z.object({
      type: z.literal("options"),
      options: z.array(z.object({
        diagnostic: z.string(),
        rationale: z.string(),
        rootCauseAddressed: z.string(),
        whereToGet: z.string(),
      })).max(5),
      reasoning: z.string().describe("Why these options were selected"),
    }),
  ]),
});
```

**Same pattern for:** `recommendDietLifestyle`, `recommendSupplements`

### 3.5 Prompt Changes Required

**Tool prompts must:**
- Remove selection/prioritization language
- Focus on lookup + enrichment + personalization
- Handle both specific and vague inputs
- Return options when ambiguous (not make final choice)

**Example new prompt structure:**
```
# Goal: Enrich Specific Recommendation with Database Details

**Data provided:**
- CSV database: [description]
- Requested item: [from primary agent directives]
- Client context: [personalization factors]
- Objective: [strategic guidance]

**Your job:**
1. Find best match(es) for requested item in database
2. If specific match found: Return enriched details with personalization
3. If ambiguous (multiple matches): Return 3-5 options with reasoning

**Note:** Think from first principles about which database entries best match the request.
```

**Separation of concerns:**
- Prompt = intent (lookup and enrich)
- Schema = contract (specific vs options structure)

---

## Part 4: Phase Structure Redesign

### 4.1 Current Phases (Analysis-Driven)

**Phase 1: Analyze & Identify Root Causes**
- Agent analyzes all client data
- Uses interpretation guides + research
- Identifies fundamental root causes
- Research validates mechanisms

**Phase 2: Generate Recommendations**
- Agent calls recommendation tools with root causes
- Tools select best interventions
- Agent validates selections with research

**Phase 3: Client-Facing Synthesis**
- Agent synthesizes complete report
- Inline citations throughout
- Explains interconnections

### 4.2 New Phases (Directive-Driven)

**Phase 1: Extract & Parse**

Operations:
1. **Parse questionnaire data:**
   - Find all questions with ratings ≥2
   - Extract open-ended issues from free text responses
   - Handle sub-questions (only include if parent ≥2)

2. **Parse takehome data:**
   - Extract numeric values (heart rate, temp, etc.)
   - Compare against interpretation guide thresholds
   - Flag abnormalities

3. **Extract directives from notes:**
   - Parse Dalton's Final Notes for specific interventions
   - Parse Advisor Notes for additional directives
   - Identify: diagnostics, supplements, lifestyle, diet interventions
   - Handle free-form prose (not structured lists)

4. **Track extraction state:**
   - Use thinkTool to capture what was found
   - Note ambiguities for later resolution

**Phase 2: Enrich & Synthesize**

Operations:
1. **Build Assessment Findings section:**
   - For each flagged questionnaire item: map to interpretation guide → personalize
   - For each flagged takehome item: map to interpretation guide → personalize
   - Use bioenergetic reasoning when no direct guide mapping exists
   - Draft interconnection narrative (bioenergetic cascades connecting findings)

2. **Research citations for Assessment Findings:**
   - Execute research objectives for key mechanisms mentioned
   - Track sources for References section

3. **Enrich directive items:**
   - For each diagnostic: call `recommendDiagnosticsTool` → get details
   - For each supplement: call `recommendSupplementsTool` → get dosage/source
   - For each lifestyle intervention: call `recommendDietLifestyleTool` → get implementation
   - Handle vague directives: get options → reason about best fit → potentially recall
   - Handle gaps: use Advisor notes as fallback → use bioenergetic reasoning if still missing (conservative)

4. **Research citations for Recommendations:**
   - Execute research objectives for each recommendation category
   - Track sources for References section

5. **Draft report sections:**
   - Introduction (personalized to client)
   - Philosophy (brief bioenergetic framework)
   - Assessment Findings (prose with interconnection narrative)
   - Recommendations (tables: Diagnostics, Diet & Lifestyle, Supplements)
   - Conclusion (summary with safety notes)

**Phase 3: Research & Finalize**

Operations:
1. **Research any remaining citation needs:**
   - Fill gaps in References section
   - Ensure each subsection has adequate citations

2. **Build References section:**
   - Subsections: Assessment Findings, Diagnostics, Diet & Lifestyle, Supplements, Other
   - Format: `[Author et al. (Year). Paper Title.](url)`
   - Extract author/year from research tool output (or infer from title/URL)

3. **Output final report:**
   - Complete markdown with all sections
   - Clean, readable formatting
   - Academic citations at bottom (not inline)

### 4.3 Why This Structure?

**First principle:** Phase structure should match cognitive operations, not arbitrary divisions.

- **Phase 1:** All extraction/parsing happens together (similar operation)
- **Phase 2:** All enrichment/synthesis happens together (similar operation)
- **Phase 3:** All citation gathering happens together (similar operation)

**Benefit:** Clear separation of concerns, easier to track progress, more maintainable.

---

## Part 5: Report Structure Changes

### 5.1 Current Structure

```markdown
# Introduction
[Personalized opening]

# Prism Bioenergetic Philosophy
[Framework explanation]

# Root Causes
[Agent-identified fundamental causes with inline citations]
[Interconnections explained]

# Recommendations
## Diagnostics (table)
## Diet & Lifestyle (table)
## Supplements & Pharmaceuticals (table)
[All with inline citations]

# Conclusion
[Summary with inline citations]
```

### 5.2 New Structure

```markdown
# Introduction
[Personalized opening anchored to client's top concerns]

# Prism Bioenergetic Philosophy
[Brief framework, connected to client context]

# Assessment Findings
[Prose narrative for each flagged issue]
[Map to interpretation guides with personalization]
[Interconnection narrative: bioenergetic cascades connecting findings]

# Recommendations
## Diagnostics (table)
[Item | Rationale | Root Cause Addressed | Where to Get]

## Diet & Lifestyle (table)
[Intervention | Rationale | Implementation | Root Cause Addressed]

## Supplements & Pharmaceuticals (table)
[Supplement | Rationale | Dosage | Source | Root Cause Addressed]

[All from directives, enriched with database details]

# Conclusion
[How interventions address findings]
[Interconnections and principles]
[Safety notes and contraindications]

# References
## Assessment Findings
[Academic citation 1](url)
[Academic citation 2](url)

## Diagnostic Recommendations
[Academic citation 3](url)

## Diet & Lifestyle Recommendations
[Academic citation 4](url)

## Supplement Recommendations
[Academic citation 5](url)
[Academic citation 6](url)
```

### 5.3 Key Differences

| Section | OLD | NEW |
|---------|-----|-----|
| Root Causes | Agent-identified, analysis-driven | Assessment Findings: mapping + personalization |
| Recommendations | Agent-selected | Directive-driven, enriched with details |
| Citations | Inline throughout | Academic format at bottom, grouped by section |
| Interconnections | Throughout Root Causes | Concise narrative at end of Assessment Findings |

---

## Part 6: System Prompt Transformation

### 6.1 Current Prompt Structure

```
BIOENERGETIC_KNOWLEDGE

<interpretation_guides>
  questionnaire.md + takehome.md
</interpretation_guides>

<client_data>
  questionnaire, takehome, advisor notes
</client_data>

# Context: You are assisting Prism Health
# Goal: Three-Phase Bioenergetic Health Report

<phase_1>
## Phase 1: Identify Root Causes
[Agent analyzes and decides root causes]
[Authority: Guides PRIMARY, Research SECONDARY]
</phase_1>

<phase_2>
## Phase 2: Generate Recommendations
[Agent calls tools, validates with research]
</phase_2>

<phase_3>
## Phase 3: Client-Facing Synthesis
[Agent synthesizes with inline citations]
</phase_3>
```

### 6.2 New Prompt Structure

```
BIOENERGETIC_KNOWLEDGE

<interpretation_guides>
  questionnaire.md + takehome.md
</interpretation_guides>

<client_data>
  <questionnaire_responses>...</questionnaire_responses>
  <takehome_assessment>...</takehome_assessment>
  <advisor_notes>...</advisor_notes>
  <daltons_final_notes>...</daltons_final_notes>
</client_data>

# Context: You are assisting Prism Health

Prism creates personalized client reports using bioenergetic principles. You are generating this report based on expert directives and client assessment data.

# Your Role: Executor & Enricher

You are executing directives from Prism's experts, not making primary clinical decisions. Your intelligence is applied to:
- Extracting and mapping client data to implications
- Enriching directives with database details and personalization
- Connecting findings through bioenergetic principles
- Gathering evidence-based citations

**Authority Hierarchy:**
1. Dalton's Final Notes (MOST weight - primary directives for interventions)
2. Advisor Notes (SECOND most weight - fallback directives)
3. Interpretation Guides (PRIMARY authority for symptom → implication mapping)
4. Your Bioenergetic Reasoning (BOUNDED - only for ambiguity resolution and gap filling)

**Conflict Resolution:** If Dalton's and Advisor's notes conflict, always follow Dalton's notes.

**Gap Filling:** If directives are incomplete, use Advisor notes as fallback. Only add interventions from your own reasoning if a critical gap exists (be conservative).

# Goal: Three-Phase Directive-Driven Report

Generate a comprehensive report that executes expert directives with intelligent enrichment.

**Output Expectation:** Your streamed output becomes the client report. Do not output any text until you begin writing the final report. Use thinkTool for all analysis, planning, and tracking during phases.

<phase_1>
## Phase 1: Extract & Parse

**Operations:**

1. **Parse Questionnaire:** Identify all questions with ratings ≥2 or open-ended issues. For sub-questions, only include if parent question rated ≥2. For open-ended responses, assess if they indicate an issue.

2. **Parse Take-Home:** Extract numeric values and compare against interpretation guide thresholds. Flag abnormalities requiring attention.

3. **Extract Directives:** From Dalton's Final Notes (primary) and Advisor Notes (fallback), extract:
   - Specific diagnostic tests recommended
   - Specific supplements/pharmaceuticals recommended
   - Specific diet/lifestyle interventions recommended

   Notes are free-form prose. Extract items intelligently.

4. **Track State:** Use thinkTool to capture extraction results and note ambiguities.

**Note:** Think clearly about what data is present and what needs to be mapped or enriched.
</phase_1>

<phase_2>
## Phase 2: Enrich & Synthesize

**Operations:**

1. **Build Assessment Findings:**
   - Map each flagged questionnaire item to interpretation guide implications
   - Map each flagged take-home item to interpretation guide implications
   - Personalize each finding to client's specific context
   - If no direct guide mapping exists, reason from bioenergetic first principles
   - Draft concise interconnection narrative showing bioenergetic cascades
   - Execute research to gather citations for mechanisms mentioned

2. **Enrich Directive Items:**
   - Call recommendation tools once per directive item
   - For specific items (e.g., "magnesium"): get enriched details
   - For vague items (e.g., "probiotics"): get options, reason about best fit, potentially recall
   - Retrieve: rationale, dosage/implementation, source, root cause addressed
   - Personalize rationale to client's specific situation
   - Execute research to gather citations for each recommendation category

3. **Draft Report Sections:**
   - Introduction (personalized, anchored to top concerns)
   - Philosophy (brief, connected to client context)
   - Assessment Findings (prose with interconnection narrative)
   - Recommendations (3 tables: Diagnostics, Diet & Lifestyle, Supplements)
   - Conclusion (summary, interconnections, safety notes)

**Note:** Recommendations come from directives, not your analysis. Your job is enrichment with database details and personalization.
</phase_2>

<phase_3>
## Phase 3: Research & Finalize

**Operations:**

1. **Complete Citation Gathering:** Execute any remaining research objectives to ensure each report section has adequate supporting evidence.

2. **Build References Section:**
   - Create subsections: Assessment Findings, Diagnostic Recommendations, Diet & Lifestyle Recommendations, Supplement Recommendations
   - Format citations academically: [Author et al. (Year). Paper Title.](url)
   - Extract author/year from research output, or infer from title/URL if not explicit
   - Group citations by relevance to each subsection

3. **Output Final Report:** Stream complete markdown report with all sections including References at bottom.

**Note:** Research is ONLY for citation gathering, not for validation or decision-making.
</phase_3>

<output_structure>
## Output Structure

Use clean, readable Markdown with clear section headings. Keep language concise, client-facing, and evidence-based. Do NOT use inline citations - all citations go in References section at bottom.

1. **Introduction:** Personalized to client, summarizing what report covers
2. **Philosophy:** Brief bioenergetic framework connected to client context
3. **Assessment Findings:** Prose narrative mapping flagged issues to guide implications with personalization. End with concise interconnection narrative showing bioenergetic cascades.
4. **Recommendations:** Three Markdown tables (Diagnostics, Diet & Lifestyle, Supplements). Include implementation details from tools.
5. **Conclusion:** Summary of how interventions address findings, interconnections, safety notes
6. **References:** Subsections for each report area, academic format citations

**Important:** Minimal fluff - only what's relevant and important. Clear, concise, interconnected, evidence-based.
</output_structure>
```

### 6.3 Key Prompt Changes

**Additions:**
- Role clarification (Executor & Enricher, not Decision Maker)
- Authority hierarchy (explicit weights)
- Dalton's Final Notes as primary directive source
- Gap filling guidance (conservative)
- Conflict resolution (Dalton's wins)
- Research purpose shift (citations only, not validation)
- References section structure
- Academic citation format

**Removals:**
- Analysis language ("identify root causes through analysis")
- Selection language ("select best interventions")
- Inline citation instructions

**Tone shift:**
- FROM: "Analyze and identify..."
- TO: "Extract and map..."
- FROM: "Select interventions..."
- TO: "Enrich directives..."

### 6.4 Prompt Design Principles Applied

✅ **Intent over prescription:** Clear goals, not micromanagement
✅ **Separation of concerns:** Prompt = intent, schema = contract
✅ **No schema overlap:** Schema descriptions not repeated in prompt
✅ **Data clarity:** Explicit about what each section IS
✅ **Autonomy enabled:** Agent can reason within bounded context

---

## Part 7: Research Tool Usage Transformation

### 7.1 Current Usage (Throughout for Validation)

**When:** During Phase 1 and Phase 2
**Why:** Validate mechanisms and interventions
**Output:** Research findings inform decisions, citations used inline

**Pattern:**
```
Agent: "I believe client has SIBO based on symptoms"
→ Research "SIBO mechanisms endotoxin"
→ Validate hypothesis
→ Include findings in Root Causes section with inline citations

Agent: "I selected magnesium glycinate"
→ Research "magnesium glycinate sleep benefits"
→ Validate selection
→ Include in Recommendations with inline citations
```

### 7.2 New Usage (Only at End for Citations)

**When:** During Phase 2 (after each section drafted) and Phase 3 (final gaps)
**Why:** Gather scientific citations for completed sections
**Output:** Academic citations grouped in References section at bottom

**Pattern:**
```
Agent: [Drafts Assessment Findings section with implications]
→ Research "gut-brain axis inflammation mechanisms"
→ Track citation for References > Assessment Findings subsection

Agent: [Enriches magnesium directive with database details]
→ Research "magnesium glycinate efficacy studies"
→ Track citation for References > Supplement Recommendations subsection

Agent: [After all sections drafted]
→ Build References section with all tracked citations
→ Format academically: [Author et al. (Year). Title.](url)
```

### 7.3 Research Objective Design

**Current:** Broad, exploratory
```
"Research SIBO mechanisms and downstream effects on thyroid function"
```

**New:** Targeted, citation-focused
```
"Find 2-3 peer-reviewed studies on small intestinal bacterial overgrowth mechanisms and metabolic impacts. Provide citations in format: Author et al. (Year). Title. URL"
```

### 7.4 Research Tool Configuration

**No tool code changes needed** - tools work the same

**Changes needed:**
- Prompt instructions for research objectives (citation-focused)
- Citation format extraction from results
- Tracking citations during phases for final assembly

---

## Part 8: Implementation Roadmap

### 8.1 Phase 1: Schema & Data Layer

**Files to modify:**
1. `lib/schemas/phase1.ts`
   - Add `daltonsFinalNotes` field to schema
   - No other changes needed

2. `app/report/phase1-form.tsx`
   - Add fourth textarea component
   - Add localStorage autosave key
   - Update validation logic
   - Update character counter
   - Update form submit payload

3. `server/phase1Cases.ts`
   - No changes needed (handles any valid schema)

4. `server/phase1Results.ts`
   - No changes needed

**Testing:** Verify form submission persists all 4 fields correctly

### 8.2 Phase 2: Tool Architecture Refactor

**Files to modify:**
1. `app/api/report/phase1/tools/recommendDiagnostics/schema.ts`
   - Refactor input schema (requestedItem instead of rootCauses)
   - Refactor output schema (specific vs options discriminated union)
   - Update descriptions for new purpose

2. `app/api/report/phase1/tools/recommendDiagnostics/agent.ts`
   - Update prompt for lookup + enrichment paradigm
   - Remove selection/prioritization language
   - Add logic for specific vs vague matching
   - Maintain CSV caching pattern

3. `app/api/report/phase1/tools/recommendDiagnostics/tool.ts`
   - Update tool description
   - Update logging for new usage pattern

4. Repeat for:
   - `app/api/report/phase1/tools/recommendDietLifestyle/*`
   - `app/api/report/phase1/tools/recommendSupplements/*`

**Testing:** Test tool with specific item → returns enriched details. Test with vague item → returns options.

### 8.3 Phase 3: System Prompt Transformation

**Files to modify:**
1. `app/api/report/phase1/analyze/systemPrompt.ts`
   - Add `daltonsFinalNotes` to client_data section
   - Rewrite role clarification (Executor & Enricher)
   - Add authority hierarchy
   - Rewrite Phase 1 instructions (Extract & Parse)
   - Rewrite Phase 2 instructions (Enrich & Synthesize)
   - Rewrite Phase 3 instructions (Research & Finalize)
   - Update output structure (References section)
   - Remove inline citation instructions
   - Apply prompt design principles (intent over prescription)

**Testing:** Review prompt manually for clarity, adherence to principles

### 8.4 Phase 4: Primary Agent Integration

**Files to modify:**
1. `app/api/report/phase1/analyze/route.ts`
   - Verify tools array includes all 6 tools (no changes needed)
   - Verify streaming callbacks handle tool status correctly
   - No architectural changes needed

2. `app/api/report/phase1/tools/thinkTool.ts`
   - Update description to reflect new usage (extraction tracking, enrichment planning)
   - No logic changes needed

3. `app/api/report/phase1/analyze/streamCallbacks.ts`
   - No changes needed (already correct pattern)

**Testing:** Run end-to-end with sample case, verify phases execute correctly

### 8.5 Phase 5: Frontend Display

**Files to modify:**
1. `app/report/analysis/[caseId]/report-analysis-stream.tsx`
   - Verify SSE parsing handles all events correctly
   - No changes needed (already correct)

2. `app/report/analysis/[caseId]/page.tsx`
   - No changes needed

**Testing:** Verify streaming display, progress indicators, final report rendering

### 8.6 Phase 6: Cleanup

**Files to remove/clean:**
- Remove any unused code from old paradigm
- Clean up old comments referencing analysis-driven approach
- Update `docs/report_proj_overview.md` to reflect new paradigm
- Update `app/api/report/directory-structure.md`
- Update `app/report/directory-structure.md`

### 8.7 Testing Strategy

**Unit tests:**
- Schema validation with all 4 fields
- Tool input/output with new schemas
- Citation format extraction

**Integration tests:**
- Form submission → storage
- Tool calls with specific/vague items
- Research objective execution
- Citation assembly

**End-to-end tests:**
- Full report generation with sample case
- Verify directive extraction works
- Verify tool enrichment works
- Verify References section populated
- Verify no inline citations present

---

## Part 9: Risk Mitigation & Edge Cases

### 9.1 Directive Extraction Challenges

**Risk:** Free-form notes are ambiguous, agent might miss items

**Mitigation:**
- Use thinkTool to explicitly list extracted items for tracking
- Design prompt to handle common patterns ("recommend X", "consider Y", "patient needs Z")
- Test with diverse note formats during development

### 9.2 Fuzzy Matching Failures

**Risk:** Directive says "fish oil", CSV has 10 fish oil variants, agent confused

**Mitigation:**
- Tool returns options when ambiguous (not errors)
- Primary agent reasons about best fit from options
- Tool description explicitly handles vague inputs
- Conservative approach: if truly unclear, note in report rather than guess

### 9.3 Gap Filling Boundaries

**Risk:** Agent over-reaches and adds items not in directives

**Mitigation:**
- Prompt explicitly states "be conservative"
- Define "critical gap" as safety-relevant or obvious bioenergetic need
- Use thinkTool to justify any agent-added items
- Test with incomplete directives during development

### 9.4 Citation Format Issues

**Risk:** Research output doesn't contain author/year metadata

**Mitigation:**
- Prompt research objectives to request academic format
- Agent infers from title/URL if not explicit
- Acceptable to have non-perfect format (better than no citation)
- Research tools could be enhanced later if needed

### 9.5 Conflict Resolution Failures

**Risk:** Agent doesn't properly detect Dalton's vs Advisor conflicts

**Mitigation:**
- Use thinkTool to explicitly compare notes when uncertainty exists
- Prompt explicitly states "Dalton's always wins"
- Test with conflicting directives during development

---

## Part 10: Success Criteria

### 10.1 Functional Requirements

✅ Agent executes directives from Dalton's/Advisor notes (not autonomous decisions)
✅ Agent maps questionnaire/takehome flags (≥2) to interpretation guides
✅ Agent enriches directive items with database details via per-item tool calls
✅ Agent personalizes all content to client's specific context
✅ Agent gathers citations after content generation (not during)
✅ Report has References section at bottom (not inline citations)
✅ References formatted academically and grouped by section

### 10.2 Quality Requirements

✅ Directives are accurately extracted from free-form notes
✅ Fuzzy matching works for vague directive items
✅ Tool enrichment provides useful details (rationale, dosage, source)
✅ Personalization is relevant and specific to client
✅ Assessment Findings maps correctly to guides
✅ Interconnection narrative is concise and clear
✅ Report is not unnecessarily verbose
✅ Citations are relevant to their subsections

### 10.3 Architectural Requirements

✅ Separation of concerns (prompt = intent, schema = contract)
✅ Tool single responsibility (lookup + enrich, not select)
✅ Phase structure matches cognitive operations
✅ Authority hierarchy enforced in practice
✅ No remnants of old analysis-driven paradigm
✅ Code is maintainable and clear

---

## Part 11: First Principles Summary

### Core Principles Applied

1. **Authority Clarity:** Humans decide clinical interventions, AI executes and enriches
2. **Single Responsibility:** Each tool does one thing well (lookup + enrich)
3. **Separation of Concerns:** Prompt defines intent, schema defines contract
4. **Cognitive Alignment:** Phase structure matches actual cognitive operations
5. **Composability:** Primary agent orchestrates many small tool calls vs few large ones
6. **Clarity Over Cleverness:** Simple, explicit patterns over complex abstractions
7. **Conservative Gaps:** Agent adds minimally when directives incomplete
8. **Evidence Last:** Research gathers citations after content created, not during

### Why This Architecture Is Better

**Current System Weakness:** Agent makes clinical decisions autonomously without human oversight

**New System Strength:** Agent executes expert decisions with intelligent enrichment at scale

**Fundamental Improvement:** Combines human clinical judgment with AI's ability to map, enrich, personalize, and cite systematically

**Architectural Benefit:** Clear boundaries, composable tools, maintainable prompts, testable components

---

## Part 12: Next Steps

1. Review this document thoroughly
2. Clarify any remaining questions
3. Begin implementation following roadmap
4. Test incrementally at each phase
5. Validate with real client data
6. Iterate based on results

**End of Document**

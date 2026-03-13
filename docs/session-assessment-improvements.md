# Assessment Route Improvements — Session Summary

## What we did

### 1. Deep understanding of the /assessment architecture

Read and internalized every file in the assessment flow end-to-end:

**Two-agent architecture:**
- **Intake agent** (Opus 4.6, structured output, no tools): Generates dynamic questions based on accumulated intake steps. Uses 3 knowledge files (`knowledge.md`, `intake_intelligence.md`, `prism_process.md`). Stateless — client sends full `IntakeStep[]` history on each call. 4-status model: `in_progress` → `transition` → `follow_up` → `complete`.
- **Assessment generation agent** (Opus 4.6, evidence tools, adaptive thinking): Takes completed intake steps + optional name, generates narrative assessment with Exa-backed research citations. Uses 7 knowledge files. Up to 5 agentic steps with `search` and `read` tools.

**Frontend state machine** (`useAssessmentWizard`): `useReducer` with 9 phases — `intro` → `goals` → `loading_step` ↔ `answering` → `transition` → `loading_step` ↔ `answering` → `name_collect` → `generating` → `result`. Client owns all state with localStorage persistence (`prism-assessment`, schema v2).

### 2. Full E2E audit via browser automation

Ran through the entire assessment as a realistic user (Chrome browser tools):

**Test persona:** Someone dealing with fatigue, digestive issues, poor sleep, brain fog, and mood/anxiety. Provided specific details: afternoon crashes, 2-year duration, stress-triggered onset, failed keto attempt, 3am waking, cold extremities, coated tongue, loose stools.

**Flow observed:**
- Intro → Q1 (static health goal chips, multi-select + free text)
- Q2: Past attempts (agent threaded "fatigue, digestive issues, sleep" into question)
- Q3: Duration/onset (agent threaded "stressful work period 2 years ago" from free text)
- Q4: Progress/blockers (agent referenced the specific stressor)
- Q5: Self-assessment ("If you had to bet on whether you could figure this out on your own...")
- Transition: Personalized message naming 3 follow-up threads (digestion specifics, 3am waking, temperature/metabolic signs)
- Follow-up 1: Bloating timing (within 30 min vs 1-3 hours — maps to stomach vs small intestine)
- Follow-up 2: 3am waking details + cold extremities (combined threads 2 and 3)
- Follow-up 3: Keto experience symptoms (colder, irritable, cravings, hair/nails)
- Name collection → Generation (~60s) → Result with citations and causal chain diagram

**Diagnostics checked:**
- `backdrop-filter` elements on sticky/fixed elements: **0** (no GPU crash risk per `docs/animation-gpu-pitfalls.md`)
- Spring animations inside AnimatePresence: **0** (no flickering risk)
- Console errors/warnings: **0** throughout entire flow (no React controlled/uncontrolled warnings)
- DOM nodes on result page: **209** (lightweight)
- localStorage persistence: working correctly (result stored and restorable)

### 3. Server log analysis

**Intake agent performance (9 API calls):**

| Call | Status | Time | Output | Cache hit | Cost |
|------|--------|------|--------|-----------|------|
| 1 | in_progress | 8.4s | 230 tok | 0% (cold write: 13,172 tok) | $0.089 |
| 2 | in_progress | 7.6s | 185 tok | 98.2% | $0.012 |
| 3 | in_progress | 6.8s | 171 tok | 97.4% | $0.013 |
| 4 | in_progress | 6.8s | 157 tok | 96.6% | $0.013 |
| 5 | transition | 13.8s | 373 tok | 96.3% | $0.018 |
| 6 | follow_up | 7.8s | 238 tok | 96.2% | $0.015 |
| 7 | follow_up | 8.3s | 229 tok | 95.1% | $0.016 |
| 8 | follow_up | 7.6s | 241 tok | 94.1% | $0.017 |
| 9 | complete | 5.7s | 44 tok | 93.5% | $0.012 |

Intake total: **~$0.21, ~72s wall-clock**. Cache working excellently — 13,172 token system prompt written on call 1, 93-98% hit rates on all subsequent calls. Transition call 2x slower (13.8s) due to larger output (373 tokens for personalized message with 3 threads).

**Assessment generation performance:**

| Metric | Value |
|--------|-------|
| Wall time | 60.5s |
| Agentic steps | 3 |
| Tool calls | 4 search, 0 read |
| Input tokens | 29,604 |
| Output tokens | 1,557 |
| Cache hit | **0.0%** |
| Cost | **$0.187** |

Key finding: **0% cache hit** because the route passed `system` as a plain string prop with no `cacheControl`. The ~25K token system prompt was re-billed at full price ($5/M) on every step.

**Total session cost: ~$0.39** ($0.21 intake + $0.19 generation)

**PDF generation:** 5.1s, 117KB, 3-page branded document — fast, clean.

---

## Issues identified

| Issue | Severity | Root cause | Status |
|-------|----------|-----------|--------|
| Transition message renders `**bold**` as literal asterisks | UX bug | `assessment-transition.tsx` line 57 renders `{message}` in a `<p>` tag — plain text, no markdown processing | **Fixed** |
| Transition message is a dense wall of text | UX | No visual separation between intro paragraph and numbered follow-up threads | **Fixed** |
| No PDF download on assessment result page | Feature gap | `assessment-result.tsx` only had report + purchase CTA; quiz flow has full PDF pipeline but assessment didn't use it | **Fixed** |
| Assessment generation 0% cache hit | Cost | `generate/route.ts` passed `system` as top-level string prop — no `cacheControl` configured. Each agentic step re-paid full price for ~25K system prompt tokens | **Fixed** |
| Inter-step latency ~8-12s per intake question | UX/conversion | Opus 4.6 structured output generation time. Skeleton animation masks it but cold traffic from paid ads may bounce | **Deferred** |
| Purchase CTA is placeholder (`/purchase`) | Known | Intentional placeholder awaiting real purchase page URL | N/A |

---

## Changes implemented

### Change 1: Transition markdown rendering + visual structure

**File modified:** `components/assessment/assessment-transition.tsx`

**What changed:**
- Line 7: Added `import { Response } from "@/components/ai-elements/response"`
- Lines 57-59: Replaced `<p className="...">` with `<div className="... [&_ol]:mt-3 [&_ol]:mb-1 [&_li]:mb-2"><Response>{message}</Response></div>`

**Why this works:**
- `Response` wraps Streamdown (already bundled across the app for all markdown rendering — zero additional cost)
- Streamdown renders `**bold**` as `<strong>`, numbered lists as `<ol>`, paragraphs with spacing
- Existing `[data-streamdown]` CSS selectors in `globals.css` handle all styling automatically
- Wrapper `div` preserves original typography (`text-[15px] leading-[1.8]`) and adds `[&_ol]:mt-3 [&_ol]:mb-1 [&_li]:mb-2` for breathing room between the intro paragraph and numbered follow-up threads
- No `variant="report"` — this is a transition message, not a report context
- Gold-bordered card, sparkles icon, heading, and CTAs all unchanged

### Change 2: PDF download on assessment result

**Files created:**
- `app/api/assessment/pdf/route.ts` — POST endpoint accepting `{ assessmentId: string }`. Pipeline: `getAssessmentResult(id)` → `markdownToHtml(report)` → `buildAssessmentHtml(html)` → `generatePdf(fullHtml)` → PDF blob response with `Content-Disposition: attachment`. Error handling for missing results (404), generation failures (500). `maxDuration = 60`. Logging with `[Assessment PDF Export]` prefix.
- `app/api/assessment/pdf/lib/assessmentTemplateBuilder.ts` — 15-line wrapper: wraps HTML in `<div class="content-section">` for PDF CSS targeting. Matches quiz template builder pattern exactly.

**File modified:** `components/assessment/assessment-result.tsx`
- Added imports: `useCallback`, `useState`, `FileDown`, `Loader`, `Button`
- Unified `trackEngagement(assessmentId, type)` replaces old single-purpose `trackBookingClick` — now handles both `"pdf_download"` and `"booking_click"` events. Same fire-and-forget pattern with `keepalive: true`.
- `downloadPdf` callback (lines 36-83): Opens blank tab synchronously within user gesture context (mobile browser compat), POSTs to `/api/assessment/pdf`, receives blob, redirects blank tab to blob URL. Fallback: creates download link if popup blocked. Error handling: closes blank tab, alerts user. `useCallback` with `[resultId]` dependency.
- PDF button (lines 132-160): `motion.div` with stagger delay 0.25s. Outline `Button` with `FileDown` icon, toggles to `Loader` + "Generating PDF..." while downloading. Subtitle: "Download a PDF copy to reference or share".
- Purchase CTA delay adjusted from 0.3 to 0.4 to stagger after the PDF button.

**Reused as-is (no modifications):**
- `lib/pdf/generatePdf.ts` — Puppeteer PDF generation (serverless-aware)
- `lib/pdf/markdownToHtml.ts` — unified remark/rehype pipeline
- `lib/pdf/pdfStyles.ts` — 561 lines of branded PDF CSS
- `app/api/assessment/engagement/route.ts` — already accepts `type: z.string().min(1)`, no change needed for `"pdf_download"` events

**Verified during session:** Clicked "Save Your Assessment" button → blank tab opened → PDF generated in 5.1s → 3-page branded document (117KB) rendered in Chrome's PDF viewer with gold headings, citations as blue links, causal chain diagram in code block.

### Change 3: Prompt caching on assessment generation

**File modified:** `app/api/assessment/generate/route.ts`

**What changed:**
- Line 12: Added `import { CacheManager } from "@/app/api/agent/lib/cacheManager"`
- Lines 18-19: Module-scope instantiation of `cacheManager` and `cachedTools` (tools with `cacheControl` on last tool definition)
- Lines 112-124: Replaced top-level `system` string prop with explicit system message in `messages` array carrying `providerOptions.anthropic.cacheControl: { type: "ephemeral" }`. This marks the ~25K token system prompt for caching with 5-minute TTL.
- Line 125: `tools: assessmentTools` → `tools: cachedTools` (last tool marked with cache control so tool schemas are cached)
- Lines 126-128: Added `prepareStep` callback using `cacheManager.applyHistoryCacheBreakpoint()` — strips stale cache breakpoints from previous steps and applies a fresh breakpoint to the last non-system message. This incrementally caches tool call results across agentic steps.

**Why not `buildCachedSystemMessages({ stable, dynamic: "" })`:** The CacheManager's `buildCachedSystemMessages` always returns two system messages — including one with empty content when `dynamic: ""`. Sending an empty system message is wasteful. Since the assessment system prompt is entirely stable (no per-user dynamic content unlike the agent route), we construct the single cached system message directly.

**Three tiers cached:**

| Tier | What gets cached | Tokens | Mechanism |
|------|-----------------|--------|-----------|
| Tools | `search` + `read` tool schemas | ~500 | `prepareCachedTools()` marks last tool with `cacheControl` |
| System prompt | 7 knowledge files + all instructions | ~25K | System message with `cacheControl: { type: "ephemeral" }` |
| Conversation history | Tool calls + results from prior steps | Growing | `prepareStep` → `applyHistoryCacheBreakpoint()` on each step |

**How Anthropic prompt caching works (from docs research):**
- Cache is prefix-based with exact byte matching. Tokens up to a `cache_control` breakpoint are cached.
- Each agentic step in a `generateText` tool loop IS a separate API call to Anthropic. Step 1 writes cache (25% surcharge: $6.25/M), steps 2+ read from cache (90% discount: $0.50/M).
- Cache is organization-scoped with 5-minute TTL that refreshes on every hit. Multiple users hitting the endpoint within the TTL window share the cache.
- Minimum cacheable prefix for Opus 4.6: 4,096 tokens. Our system prompt (~25K) is well above threshold.
- Zero impact on model output quality — caching stores computed KV attention pairs, model receives identical tokens.

**Baseline (before):** 0% cache hit, $0.187 per generation, 29,604 uncached input tokens, $0.000 saved.
**Expected (after):** 50-80% cache hit on steps 2+, ~$0.12-0.14 per generation, positive savings. Cross-user cache hits during traffic.

---

## Current state

All changes are implemented and the assessment-result PDF download has been verified working. The transition markdown fix and cache optimization need verification on the next full intake run.

**To run a fresh assessment:** Clear `prism-assessment` from localStorage (DevTools → Application → Local Storage → localhost:3000 → delete `prism-assessment`, or run `localStorage.removeItem('prism-assessment')` in console).

**What to verify on next run:**

1. **Transition screen:** Follow-up thread names (e.g. "Your digestion specifics") should render in bold, numbered items should have visual spacing between them — not a wall of text with literal `**` asterisks.

2. **Server logs during generation:** The `[Assessment] Cache:` line should show non-zero `write` (step 1) and non-zero `read` (steps 2+). Hit rate should be 50-80% vs the previous 0.0%. The `saved:` value should be positive vs the previous `$0.0000`.

3. **Result page PDF button:** "Save Your Assessment" button between report and purchase CTA (already verified working).

**Deferred:** Inter-step intake latency (~8-12s per question) as a conversion concern for cold traffic from paid ads.

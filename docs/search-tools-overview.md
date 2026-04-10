# Realtime Web Search Tools — Architectural Overview

A reference for porting this project's agentic web-search capability to other agents. Written from first principles: what each piece does, **why** it exists, and which decisions are portable vs. stack-specific.

---

## 1. Core Philosophy: The Zoom Ladder

The single most important idea is that web search is not one tool — it's a **cost/depth gradient** exposed as three tools. The agent picks the rung based on how much certainty it needs.

| Tool | Input | What it costs | What it returns | When the model should pick it |
|---|---|---|---|---|
| `search` | query + filters | 1 Exa `/search` call | 3 results × pre-selected highlights (~1250 chars each) | Breadth. "What's out there on X?" |
| `read` | known URL + query | 1 Exa `getContents` call (highlights mode) | Query-scored excerpts from one source | Medium depth. "This hit looks good, give me more on the angle I care about." |
| `extract_findings` | known URL + objective | 1 Exa full-text fetch **+ 1 nested LLM call** | Structured `{ findings[], summary }` | Deep. "This source is dense; extract and structure it." |

**Why this matters:** a flat "web_search" tool forces the model to either waste tokens on raw content or give up after shallow hits. The ladder lets the model reason at the right altitude for each question.

The three tools share one HTTP client, one rate limiter, and one provider (Exa). They are *layered views* over the same index, not three independent integrations.

### Interconnection with the system prompt
The search tools fetch **evidence**. A separate knowledge file (`evidence_hierarchy.md`) teaches the model how to *weigh* that evidence (mechanism > RCT > observational, etc.) before calling them. Tools without a judgment framework just dump data; a framework without tools is stale. The pair is what produces grounded answers.

---

## 2. File Map

```
app/api/agent/
├── route.ts                         # Agent entry; wires tools into streamText
├── tools/
│   ├── index.ts                     # Exports { search, read, extract_findings }
│   ├── searchTool.ts                # Tool 1: semantic search
│   ├── readTool.ts                  # Tool 2: targeted re-read
│   ├── depthTool/
│   │   ├── depthTool.ts             # Tool 3: full-text + nested extraction
│   │   ├── types.ts                 # Finding / ExtractionOutput shapes
│   │   └── extraction/
│   │       ├── agent.ts             # Nested Gemini call
│   │       ├── schema.ts            # Zod schema for structured output
│   │       └── prompt.ts            # Extraction instructions
│   └── exaSearch/
│       ├── exaClient.ts             # Single Exa instance; 3 primitives
│       ├── rateLimiter.ts           # Promise-chained dispatch limiter
│       └── types.ts                 # ExaSearchResult / SearchOptions
└── lib/
    ├── llmRetry.ts                  # withRetry(fn, phase)
    └── retryConfig.ts               # Per-phase timeouts / attempts
```

---

## 3. Tool 1 — `search` (Breadth)

`app/api/agent/tools/searchTool.ts`

```ts
export const searchTool = tool({
  description:
    "Search for research to build your reasoning. Nearly instantaneous. " +
    "Use this as you think, not after. Searches by meaning, not keywords. " +
    "Returns results with highlighted excerpts, often sufficient to cite. " +
    "Make parallel calls for different research angles.",
  inputSchema: z.object({
    query: z.string().describe(
      "Describe the ideal document to find. Rich, descriptive queries outperform keywords."
    ),
    includeText: z.string().optional().describe(
      "Term that MUST appear in results. Only for critical proper nouns or jargon. Max 5 words."
    ),
    excludeText: z.string().optional().describe(
      "Term that MUST NOT appear in results. For filtering noise. Max 5 words."
    ),
  }),
  execute: async ({ query, includeText, excludeText }) => {
    const { results } = await searchExa(query, {
      numResults: 3,
      category: "research paper",
      includeText,
      excludeText,
    });
    return results;
  },
});
```

### Design decisions worth stealing

1. **Tool description is a behavior spec, not a docstring.** "Use this as you think, not after" changes *when* the model reaches for it. "Make parallel calls for different research angles" unlocks fan-out without extra code. The description is how you steer the agent.
2. **Describe the ideal document, not keywords.** Exa is embedding-based; rich natural-language queries beat keyword strings. The `describe()` on the input schema trains the model to write good queries.
3. **Hard-capped to 3 results.** Anything more and the agent drowns. If it needs more, it searches again with a narrower query — that's cheaper than filtering 10 results in context.
4. **`includeText` / `excludeText` as hard filters.** Max 5 words, explicitly for proper nouns. Short constraint + clear use case = the model uses them correctly.
5. **Highlights instead of full text.** Exa returns ~1250-char highlighted excerpts. Often enough to cite directly. Full text only when the model explicitly escalates to `extract_findings`.

### The Exa call itself

`app/api/agent/tools/exaSearch/exaClient.ts`

```ts
const response = await exa.search(query, {
  type: "auto",
  numResults: options?.numResults ?? 3,
  contents: {
    highlights: { maxCharacters: 1250 },
  },
  category: (options?.category ?? "research paper"),
  ...(options?.includeText ? { includeText: [options.includeText] } : {}),
  ...(options?.excludeText ? { excludeText: [options.excludeText] } : {}),
});
```

`type: "auto"` lets Exa choose between neural and keyword search per query. `category: "research paper"` pre-filters the index — for this domain (health) it's a massive quality boost. **If porting, change the default category to whatever matches your target domain** (`"news"`, `"company"`, `"pdf"`, etc.), or pass `null` for an unfiltered search.

---

## 4. Tool 2 — `read` (Targeted Follow-Up)

`app/api/agent/tools/readTool.ts`

```ts
export const readTool = tool({
  description:
    "Get focused evidence from a specific source you already found. Nearly instantaneous. " +
    "Returns highlights selected by your query. " +
    "Use when a search result looks promising and you need more evidence from that source.",
  inputSchema: z.object({
    url: z.string().url().describe("The URL to read more from."),
    query: z.string().describe(
      "What to focus on. Excerpts are selected by relevance to this query."
    ),
  }),
  execute: async ({ url, query }) => getHighlights(url, query),
});
```

Calls `exa.getContents(url, { highlights: { query } })`. Same URL, *new query* — the highlights are re-scored against what the model cares about now, which may be a different angle than the original search. This is the rung most people skip when designing their own search stack.

**Key insight:** `read` exists because a single search hit surfaces the *most generically relevant* passages, not the passages relevant to the *specific follow-up question the model now has*. Re-querying the same document with a fresh objective is dramatically cheaper (both tokens and money) than pulling the full text.

---

## 5. Tool 3 — `extract_findings` (Depth + Nested Sub-Agent)

`app/api/agent/tools/depthTool/depthTool.ts`

```ts
export const extractFindingsTool = tool({
  description:
    "Extract specific findings and evidence from a dense source. " +
    "Returns structured findings you can cite.",
  inputSchema: z.object({
    url: z.string().url(),
    objective: z.string().describe("What specific information to look for."),
  }),
  execute: async ({ url, objective }) => {
    const fullText = await getContents(url);                  // up to 400k chars
    const extraction = await extractFromDocument(             // nested LLM
      fullText, objective, currentDate
    );
    return { ...extraction, url };
  },
});
```

### The nested-agent pattern

This is the most portable idea in the whole system.

```ts
// app/api/agent/tools/depthTool/extraction/agent.ts
export async function extractFromDocument(fullText, objective, currentDate) {
  return withRetry(async (signal) => {
    const { object } = await generateObject({
      model: google("gemini-3-flash-preview"),   // cheap, fast, structured
      schema: extractionSchema,
      prompt: getExtractionPrompt(fullText, objective, currentDate),
      abortSignal: signal,
    });
    return object;
  }, "extraction");
}
```

**Why delegate to a second model?**

- A full document can be 400k characters. Dumping that into the primary agent's context is wasteful — most of it is noise relative to the objective.
- A cheaper model (Gemini Flash here; could be Haiku, GPT-4.1-mini, whatever) can read the full text and return a structured summary for a fraction of the cost.
- The primary agent receives **only the findings** — `{ insight, evidence }[]` plus a short summary. Tight, citable, pre-filtered.
- This is a **specialization boundary**: primary agent = reasoning, sub-agent = extraction. Each gets a model/prompt tuned for its job.

### Structured output enforces discipline

`app/api/agent/tools/depthTool/extraction/schema.ts`

```ts
export const extractionSchema = z.object({
  findings: z.array(z.object({
    insight: z.string().describe("Key finding relevant to the objective."),
    evidence: z.string().describe("Direct quote or specific detail from the source."),
  })),
  summary: z.string().describe("Brief overall assessment."),
});
```

Splitting `insight` and `evidence` is deliberate. It forces the sub-agent to pair every claim with a traceable quote — no ungrounded assertions slip through. The primary agent can then cite evidence verbatim.

### The extraction prompt

`app/api/agent/tools/depthTool/extraction/prompt.ts`

```
You are an extraction agent. A primary reasoning agent identified this source
during web research as worth investigating further. Your job is to extract the
most relevant information and return structured findings that the primary agent
can use — the full text won't be available to it, only your findings.

Guidelines:
- Prefer direct quotes as evidence — they're the most trustworthy and traceable.
- Ground every finding in the actual text. No fabrication.
- Focus on the highest-value findings. Not every paragraph is worth extracting.
- Be concise — return only what matters.
```

Three things to steal:

1. **Tell the sub-agent about the primary agent.** "The full text won't be available to it" changes what it chooses to extract. It becomes a teammate, not a summarizer.
2. **Quote preference is explicit.** "Prefer direct quotes" is a one-line hallucination defense.
3. **"Quality over exhaustiveness."** Without this, extraction agents dump everything and defeat the token-saving purpose.

---

## 6. Shared Infrastructure

### Single client, no hidden state

`exaClient.ts` creates one Exa instance and exposes three primitives: `searchExa`, `getContents`, `getHighlights`. Tools call these — they never construct their own client. One place to swap providers, one place to add logging, one place to apply rate limiting.

### Rate limiter: promise-chained dispatch

`app/api/agent/tools/exaSearch/rateLimiter.ts`

```ts
export class RateLimiter {
  private lastDispatchTime = 0;
  private pendingDispatch: Promise<void> = Promise.resolve();
  private readonly intervalMs: number;

  constructor(requestsPerSecond: number) {
    this.intervalMs = 1000 / requestsPerSecond;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    const dispatch = this.pendingDispatch.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastDispatchTime;
      const waitMs = Math.max(0, this.intervalMs - elapsed);
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
      this.lastDispatchTime = Date.now();
    });
    this.pendingDispatch = dispatch.catch(() => {});  // poison guard
    await dispatch;
    return fn();
  }
}

export const exaRateLimiter = new RateLimiter(10);  // Exa limit is 15 QPS
```

**What's clever here:**

- **Dispatch is serialized; execution is concurrent.** Calls start at most one every `intervalMs`, but once started they run in parallel. Most naive limiters serialize the entire request — this one only serializes the *start*.
- **No queue, no timers.** Each call chains onto a promise. GC handles the rest.
- **Poison guard:** `.catch(() => {})` on the reassigned chain prevents a single rejected dispatch from breaking every future call. Tiny but essential.
- **10 QPS with a 15 QPS provider cap.** 33% headroom for retry bursts and clock drift.
- **Env-configurable** (`EXA_RATE_LIMIT_QPS`) so deployment can tune without a code change.

This limiter is ~30 lines, provider-agnostic, and drop-in portable.

### Retry with classification

`app/api/agent/lib/llmRetry.ts`

```ts
function classifyError(error: unknown): ClassifiedError {
  if (error?.name === "AbortError")   return { retryable: true };
  if (error?.name === "TimeoutError") return { retryable: true };
  const status = getStatusCode(error);
  if (status === 429)  return { retryable: true, retryAfterMs: getRetryAfterMs(error) };
  if (status >= 500)   return { retryable: true };
  if (status !== undefined) return { retryable: false };       // 4xx: don't retry
  if (error instanceof TypeError && error.message.includes("fetch"))
    return { retryable: true };
  return { retryable: false };
}
```

- **4xx (except 429) is not retryable.** Retrying a 400 just burns latency. This distinction catches a *lot* of people.
- **Honors `Retry-After` header** on 429s before falling back to exponential backoff with jitter.
- **Abort signal is threaded through** so each attempt gets its own timeout:

  ```ts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  try { return await fn(controller.signal); }
  finally { clearTimeout(timeoutId); }
  ```

  The `fn` must accept the signal and pass it to the SDK call. This gives you per-attempt timeouts, not a single global timeout.

### Per-phase retry config

`app/api/agent/lib/retryConfig.ts`

```ts
const defaults: Record<Phase, PhaseConfig> = {
  extraction: { timeoutMs: 25_000, maxAttempts: 2, baseDelayMs: 1_000 },
};
```

Different phases (extraction, primary generation, embedding, etc.) have different tolerances. Config is per-phase and env-overridable (`RETRY_EXTRACTION_TIMEOUT_MS`, etc.). Extraction only gets 2 attempts because the primary agent can simply call a different tool if it fails — there's a graceful fallback *at the agent level*, so aggressive retries aren't needed.

---

## 7. Wiring Into the Agent

`app/api/agent/route.ts` — the relevant slice:

```ts
import { agentTools } from "./tools";
// ...
const cachedTools = cacheManager.prepareCachedTools(agentTools);

const result = streamText({
  model: anthropic("claude-sonnet-4-6"),
  messages: initialMessages,
  tools: cachedTools,
  stopWhen: stepCountIs(10),               // max 10 tool-use steps
  providerOptions: {
    anthropic: {
      thinking: { type: "adaptive" },
      effort: "low",
      contextManagement: {
        edits: [
          { type: "clear_thinking_20251015", keep: "all" },
          {
            type: "clear_tool_uses_20250919",
            trigger: { type: "input_tokens", value: 50_000 },
            keep:    { type: "tool_uses",    value: 15 },
            clearAtLeast: { type: "input_tokens", value: 8_000 },
          },
          { type: "compact_20260112", trigger: { type: "input_tokens", value: 120_000 } },
        ],
      },
    },
  },
});
```

The tools themselves are just the Vercel AI SDK `tool()` helper — they plug into `streamText({ tools })` verbatim. Three things around them matter:

1. **`stopWhen: stepCountIs(10)`** — a hard ceiling on tool-use loops. Essential for any agentic system. Without it, the model can thrash.
2. **Prompt caching on tool definitions** (`cacheManager.prepareCachedTools`) — tool schemas are long and stable, so they're prime cache fodder. Cache reads are ~10× cheaper than fresh input. If your provider supports prompt caching, apply it to the tool set.
3. **Context management for tool-use history** — after 50k input tokens, drop old tool calls (keep the last 15). Without this, a research-heavy session blows the context window. After 120k tokens, compact. These are Anthropic-specific today but the pattern generalizes: **tool results are transient evidence; don't pay to re-send them forever.**

---

## 8. Porting Checklist

When lifting this into another project, work through in this order:

### A. Decide the ladder for your domain
- What's the cheapest useful signal? (usually pre-filtered highlights)
- What's the intermediate rung? (re-querying a known source)
- What's depth? (full text → structured extraction via sub-agent)

Don't collapse the ladder to one tool. The specialization is what makes it work.

### B. Pick a provider
- **Exa** — semantic search, good for research-heavy domains, category filters, built-in highlights. Used here.
- **Tavily** — similar API, different pricing, general-purpose.
- **Brave / SerpAPI / Google PSE** — keyword-first; you'll need to layer your own ranking.
- **Jina Reader / Firecrawl** — for the `read`/`extract` layers if your search provider doesn't do content retrieval.

The *tool surface* (search/read/extract) should stay the same regardless of provider. Swap the client, keep the tools.

### C. Copy these files almost verbatim
- `rateLimiter.ts` — provider-agnostic, ~30 lines.
- `llmRetry.ts` + `retryConfig.ts` — error classification is universally correct.
- `depthTool/extraction/*` — the nested-agent pattern, schema, and prompt template. Change only the model and the extraction objective language for your domain.

### D. Rewrite these for your domain
- **Tool descriptions.** These are the single biggest lever on agent behavior. Rewrite them for your domain vocabulary and use cases. Include *when* to use, not just *what* it does.
- **Default search category** (if your provider supports it).
- **Extraction prompt's "objective" framing** — e.g., for a legal research agent you'd want different guidelines than "prefer direct quotes from studies."

### E. Wire into the agent loop with
- Prompt caching on tool definitions (if supported).
- A hard `stopWhen` step cap. **Never ship an agent loop without one.**
- Context management for old tool results (or manual truncation if your provider doesn't support it natively).
- An `onFinish` logger that prints tool counts, token usage, and cost. You will need this immediately; retrofitting it is painful.

### F. Pair the tools with an evidence-hierarchy knowledge file
Tools without judgment criteria produce confident-sounding slop. Teach the model *how* to weigh what comes back before it calls them.

---

## 9. Non-Obvious Lessons

A handful of things that aren't in the code but the code depends on.

1. **Tool descriptions are prompts.** Treat them with the same care as your system prompt. "Use this as you think, not after" and "make parallel calls for different research angles" are behavioral directives. Change them and you change the agent.

2. **Cost lives in tool *results*, not tool calls.** A search call is ~$0.005. The result it dumps into context is charged on every subsequent turn until it's evicted. Context management is where you actually save money — the rate limiter saves you from getting banned, the context edits save you from going broke.

3. **Let the model retry by calling a different tool.** `extract_findings` has only 2 retry attempts because if it fails, the agent can fall back to `read` on the same URL. Graceful degradation at the agent level beats aggressive retries at the tool level.

4. **Don't retry 4xx.** If you take one thing from `llmRetry.ts`, take the status-code classifier. Retrying a malformed request just burns latency.

5. **Nested sub-agents are a cost lever, not an architectural flex.** The only reason to delegate to Gemini Flash (or any cheaper model) is that the primary model doesn't need to see the raw content — just the structured output. If you'd need to send the full text to the primary anyway, skip the nested call.

6. **Separate dispatch from execution in your rate limiter.** Serializing full requests is a latency tax. Serializing only the *start time* gives you the rate cap without the queue.

7. **`includeText`/`excludeText` work because they're short.** Long `includeText` values match nothing. The schema description explicitly caps it at 5 words — that's what keeps the model from over-using it.

---

## 10. Minimum Viable Port

If you want the smallest possible version of this to bolt onto another agent, you need four things:

1. **One tool** (`search`) wrapping your provider's semantic-search endpoint, with a behavior-spec description.
2. **One rate limiter** (`rateLimiter.ts`, ~30 lines).
3. **One retry wrapper** (`llmRetry.ts`, error classification only — skip phases).
4. **One `stopWhen` cap** in the agent loop.

Then add `read` and `extract_findings` once you see the agent repeatedly wanting more depth on the same URL — that's the signal you need more rungs. Don't build the ladder before you feel the need for it; you'll overfit.

# Prism Agent Integration

## Overview

The quiz project now includes a full conversational health agent. After completing a quiz and reading their assessment, users can continue into a multi-turn streaming conversation that goes deeper on their health patterns with real-time evidence retrieval.

**User flow:** Quiz → Assessment → Three CTAs (Talk to Our Team / Go Deeper on Your Results / Save Your Assessment) → Agent conversation (if they choose to explore)

## Backend

### Agent Route (`app/api/agent/route.ts`)

Streaming endpoint using Claude Opus 4.6 with:
- Three-tier Anthropic prompt caching (tool schemas, stable system prompt, conversation history)
- `prepareStep` hook for incremental cache advancement
- Context management (`clear_thinking`, `clear_tool_uses`, `compact`)
- Rate limiting (IP-based per-minute/per-hour, dev bypass)
- Input validation (message array + length)
- Comprehensive logging (cache metrics, cost calculation, context management events)
- `maxDuration: 300`

### System Prompt (`app/api/agent/systemPrompt.ts`)

Loads 8 knowledge files from `lib/knowledge/` via `Promise.all` with module-level caching:
- `knowledge.md`, `questionaire.md`, `diet_lifestyle_standardized.md`
- `metabolism_deep_dive.md`, `gut_deep_dive.md`
- `evidence_hierarchy.md`, `takehome.md`, `prism_process.md`

Prompt split into stable (cached) and dynamic (per-request) sections. The dynamic section includes the quiz variant, client name, formatted answers, and the full assessment.

Key prompt features:
- Warm greeting with name on first message
- Synthesis paragraph (agent brings patterns together when it has enough understanding)
- Dual-purpose evidence framing (tools ground reasoning AND expand it)
- Fake name handling (don't reference clearly fake names)
- Booking link shared conversationally only when contextually relevant

### Agent Tools (`app/api/agent/tools/`)

Three tools, all Exa v2 SDK (`exa-js@2.7.0`):

| Tool | Description | Config |
|------|-------------|--------|
| `search` | Semantic search for studies/sources | 5 results, no category filter, 1250 char highlights |
| `read` | Focused highlights from a specific URL | 10K char highlights |
| `extract_findings` | Full text → Gemini Flash structured extraction | 400K char text, retry with exponential backoff |

Shared infrastructure:
- `exaSearch/exaClient.ts` — configurable Exa v2 client (numResults, category)
- `exaSearch/rateLimiter.ts` — promise-chained 10 QPS
- `depthTool/` — depth extraction pipeline (Exa full text → Gemini Flash `generateObject`)

### Supporting Infrastructure (`app/api/agent/lib/`)

| File | Purpose |
|------|---------|
| `cacheManager.ts` | Three-tier prompt caching, accepts `{stable, dynamic}` |
| `rateLimit.ts` | IP-based rate limiting with dev bypass |
| `inputValidation.ts` | Message array + length validation |
| `llmRetry.ts` | Exponential backoff with jitter for extraction |
| `retryConfig.ts` | Phase-based retry configuration |

## Frontend

### Agent Page (`app/explore/[quizId]/`)

- `page.tsx` — Server component, validates quizId, loads submission/result
- `agent-page.tsx` — Client component with the full chat interface

Key patterns:
- **Auto-trigger**: Hidden first message fires on mount ("I just finished the quiz and read through my assessment. I clicked to chat with you to learn more."), filtered from rendered UI
- **Hydration-safe**: Auto-trigger waits for IndexedDB hydration before deciding to fire
- **Persistence**: Dual save — IndexedDB (client, for hydration) + server (for admin visibility)
- **Booking link detection**: Event delegation on conversation container catches clicks on `prism.miami` links

### Chat UI Components (`components/ai-elements/`)

| Component | Purpose |
|-----------|---------|
| `conversation.tsx` | Auto-scroll container (use-stick-to-bottom) |
| `message.tsx` | User/assistant message bubbles with cva variants |
| `response.tsx` | Markdown renderer (Streamdown/react-markdown) |
| `tool-status.tsx` | Animated research/reading indicator |
| `sources.tsx` | Collapsible citation drawer (compound pattern) |
| `reasoning.tsx` | Collapsible thinking block with duration tracking |
| `prompt-input.tsx` | Text input + send/stop button |

### Persistence (`hooks/use-agent-persistence.ts`)

- Hydrates from IndexedDB on mount via `lib/agent/thread-store.ts` (Dexie)
- Saves to IndexedDB when streaming completes (status: streaming/submitted → ready)
- Also saves serialized conversation to server via `lib/tracking.ts` for admin visibility

## Engagement Tracking

Full post-assessment engagement tracking, visible in the admin dashboard.

### What's Tracked

| Event | Source | Trigger |
|-------|--------|---------|
| `pdf_download` | `assessment` | User clicks "Save Your Assessment" |
| `booking_click` | `assessment` | User clicks "Talk to Our Team" |
| `agent_opened` | `assessment` | User clicks "Go Deeper on Your Results" |
| `booking_click` | `agent` | User clicks booking link in agent chat |

Conversation transcripts are saved server-side after each exchange (serialized to user/assistant text only, stripped of tool calls and reasoning).

### Storage (`server/quizEngagement.ts`)

Dual-path (Redis in prod, filesystem in dev), keyed by `quiz-engagement:{quizId}`:

```typescript
interface EngagementRecord {
  quizId: string;
  events: EngagementEvent[];
  conversation: SerializedMessage[] | null;
  summary: string | null;
  updatedAt: string;
}
```

### Client Tracking (`lib/tracking.ts`)

Fire-and-forget helpers with `keepalive: true` (survives page navigation):
- `trackEvent(quizId, type, source)` — discrete event
- `saveConversationRemote(quizId, messages)` — conversation snapshot

### Admin Display

- **Collapsed row**: Engagement badges (PDF, Booking clicked, Chat + message count)
- **Expanded view**: Events timeline with timestamps, conversation summary (on-demand), full transcript

### Conversation Summary

On-demand AI summary generated via admin button click:
- `POST /api/admin/results/summary` — admin-authenticated
- Fetches conversation + quiz context (variant, answers, assessment)
- Claude Sonnet 4.6 generates concise prose summary
- Saved to engagement record, displayed above transcript in admin

## Post-Assessment CTAs (`components/quiz/quiz-result.tsx`)

Redesigned for clarity. Equal-weight side-by-side cards on desktop:

| CTA | Label | Subtitle | Action |
|-----|-------|----------|--------|
| Booking | Talk to Our Team | Free intro call to discuss your results and how we can help | Opens booking URL (UTM-tagged) |
| Explore | Go Deeper on Your Results | Ask questions and explore your patterns with real-time research | Navigates to `/explore/{quizId}` |
| PDF | Save Your Assessment | Download a PDF copy to reference or share | Downloads assessment PDF |

The quiz agent prompt explicitly does NOT mention these options. The assessment builds trust and desire; the UI offers the paths.

## File Structure

```
app/api/agent/
├── route.ts                          Streaming endpoint (Opus 4.6, caching, logging)
├── systemPrompt.ts                   8 knowledge files, stable/dynamic split
├── tools/
│   ├── index.ts                      Exports agentTools (search, read, extract_findings)
│   ├── searchTool.ts                 Exa semantic search (5 results, no category)
│   ├── readTool.ts                   Exa focused highlights
│   ├── exaSearch/
│   │   ├── exaClient.ts              Exa v2 client (configurable)
│   │   ├── rateLimiter.ts            Promise-chained 10 QPS
│   │   └── types.ts                  Extended SearchOptions
│   └── depthTool/
│       ├── depthTool.ts              Full text → Gemini Flash extraction
│       ├── types.ts                  Finding, ExtractionOutput
│       └── extraction/
│           ├── agent.ts              withRetry + generateObject
│           ├── prompt.ts             Extraction prompt template
│           └── schema.ts             Zod schema
└── lib/
    ├── cacheManager.ts               Three-tier prompt caching
    ├── rateLimit.ts                  IP-based rate limiting
    ├── inputValidation.ts            Message validation
    ├── llmRetry.ts                   Exponential backoff
    └── retryConfig.ts                Phase-based retry config

app/api/quiz/engagement/
└── route.ts                          POST endpoint for tracking events + conversations

app/api/admin/results/summary/
└── route.ts                          POST endpoint for AI conversation summary

app/explore/[quizId]/
├── page.tsx                          Server component (validates quizId)
└── agent-page.tsx                    Client component (chat interface)

components/ai-elements/
├── conversation.tsx                  Auto-scroll container
├── message.tsx                       User/assistant bubbles
├── response.tsx                      Markdown renderer
├── tool-status.tsx                   Research indicator
├── sources.tsx                       Citation drawer
├── reasoning.tsx                     Thinking block
├── prompt-input.tsx                  Text input + send/stop
└── loader.tsx                        Loading spinner

hooks/
├── use-agent-persistence.ts          IndexedDB + server persistence
└── use-mobile.ts                     Mobile detection

lib/
├── agent/thread-store.ts             Dexie IndexedDB layer
├── tracking.ts                       Fire-and-forget engagement tracking
└── message-utils.ts                  Text extraction + citation URL parsing

server/
└── quizEngagement.ts                 Engagement storage (Redis/filesystem)
```

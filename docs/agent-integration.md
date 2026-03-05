# Prism Agent Integration

## Overview

The project includes two conversational agent modes sharing the same route, tools, and infrastructure:

1. **Post-quiz agent** (`/explore/[quizId]`): After completing a quiz, users can explore their results in a multi-turn conversation. The agent already knows their situation from quiz answers and assessment.

2. **Standalone chat agent** (`/chat`): Users can chat with the agent directly without taking a quiz. The agent discovers their health situation through conversation. Accessible from the quiz index page ("Not sure where to start?") or directly via URL.

Both modes use the same backend route (`/api/agent`), tools, caching, and model config. The only difference is the system prompt.

**Post-quiz flow:** Quiz → Assessment → Three CTAs (Go Deeper / Talk to Our Team / Save Assessment) → Agent conversation
**Standalone flow:** `/chat` → Opening question → Multi-turn conversation with thread management

## Backend

### Agent Route (`app/api/agent/route.ts`)

Single streaming endpoint serving both modes. `quizId` is optional in the request body — when present, post-quiz mode; when absent, standalone mode.

Claude Opus 4.6 with:
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

Exports two prompt builders from shared knowledge + behavioral sections:
- `buildAgentPrompt(variant, name, answers, assessment)` — post-quiz mode (stable + quiz context dynamic)
- `buildStandalonePrompt()` — standalone mode (stable + date-only dynamic)

Shared sections (~90%): Who You're Talking To, Where Prism Sits, Knowledge Foundation, Applied Bioenergetic Reasoning, Prism's Process, The Consultation, Boundaries, Scope, Evidence, Tone.

Mode-specific sections (~10%): The Situation, Your Purpose, The Conversation.

Post-quiz prompt features:
- Warm greeting with name on first message, references assessment
- Agent speaks first (auto-triggered hidden message)

Standalone prompt features:
- UI asks opening question, user types first
- Early exchanges prioritize understanding through questions
- Discovery posture (no prior context)

Both share:
- Evidence-first reasoning (tools ground AND expand)
- Markdown diagrams for system connections
- Booking link shared conversationally only when contextually relevant
- Fake name handling

### Agent Tools (`app/api/agent/tools/`)

Three tools, all Exa v2 SDK (`exa-js@2.7.0`):

| Tool | Description | Config |
|------|-------------|--------|
| `search` | Semantic search for studies/sources | 3 results, category: research paper, 1250 char highlights |
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

### Standalone Chat (`app/chat/`)

- `layout.tsx` — Server component with metadata
- `page.tsx` — Client redirect to latest thread or creates new one
- `[threadId]/page.tsx` — Server component, renders ChatPage with `key={threadId}`
- `[threadId]/chat-page.tsx` — Client component with full chat UI + sidebar

Key patterns:
- **No auto-trigger**: User types first message. Empty state shows opening question.
- **Thread management**: Sidebar with create, rename, delete via `lib/chat/thread-store.ts` (Dexie, separate `prism-chat` database)
- **Thread IDs**: `thr_{nanoid(12)}`, stored in IndexedDB with metadata (title, preview, timestamps)
- **Navigation**: "← Assessments" link back to `/quiz` in header
- **Booking detection**: Same event delegation pattern as post-quiz, tracks via `trackChatEvent`

### Chat Sidebar (`components/chat-sidebar.tsx`)

Thread list with CRUD: sorted by `updatedAt` DESC, inline rename, delete with confirmation, hover-reveal actions. Mobile: collapsible overlay.

### Post-Quiz Persistence (`hooks/use-agent-persistence.ts`)

- Hydrates from IndexedDB on mount via `lib/agent/thread-store.ts` (Dexie)
- Saves to IndexedDB when streaming completes (status: streaming/submitted → ready)
- Also saves serialized conversation to server via `lib/tracking.ts` for admin visibility

### Standalone Chat Persistence (`hooks/use-chat-persistence.ts`)

Same pattern, keyed by `threadId` instead of `quizId`:
- Hydrates from `lib/chat/thread-store.ts` (separate Dexie database)
- Derives thread title from first user message, preview from last assistant message
- Saves to server via `saveChatConversationRemote` for admin visibility

## Engagement Tracking

Two parallel tracking systems, both visible in the admin dashboard.

### Quiz Engagement (`server/quizEngagement.ts`)

Tracks post-assessment user actions, keyed by `quiz-engagement:{quizId}`:

| Event | Source | Trigger |
|-------|--------|---------|
| `pdf_download` | `assessment` | User clicks "Save Your Assessment" |
| `booking_click` | `assessment` | User clicks "Talk to Our Team" |
| `agent_opened` | `assessment` | User clicks "Go Deeper on Your Results" |
| `booking_click` | `agent` | User clicks booking link in post-quiz chat |

### Standalone Chat Engagement (`server/chatSessions.ts`)

Tracks standalone chat interactions, keyed by `chat-sessions:{threadId}`:

| Event | Source | Trigger |
|-------|--------|---------|
| `booking_click` | `chat` | User clicks booking link in standalone chat |

Both store conversation transcripts server-side (serialized to user/assistant text only).

### Storage

Both use dual-path storage (Redis in prod, filesystem in dev):

```typescript
// Quiz engagement
interface EngagementRecord {
  quizId: string;
  events: EngagementEvent[];
  conversation: SerializedMessage[] | null;
  summary: string | null;
  updatedAt: string;
}

// Standalone chat
interface ChatSession {
  threadId: string;
  conversation: SerializedMessage[] | null;
  summary: string | null;
  events: ChatEvent[];
  createdAt: string;
  updatedAt: string;
}
```

### Client Tracking (`lib/tracking.ts`)

Fire-and-forget helpers with `keepalive: true` (survives page navigation):
- `trackEvent(quizId, type, source)` — quiz engagement event
- `saveConversationRemote(quizId, messages)` — quiz conversation snapshot
- `trackChatEvent(threadId, type, source)` — standalone chat event
- `saveChatConversationRemote(threadId, messages)` — standalone conversation snapshot

### Admin Display

Tab toggle at top of admin page: **Quiz Results** | **Conversations**

**Quiz Results tab:**
- Collapsed row: Engagement badges (PDF, Booking clicked, Chat + message count)
- Expanded: Events timeline, conversation summary (on-demand), full transcript

**Conversations tab:**
- List of standalone chat sessions with message count, preview, timestamps
- Expandable: conversation summary (on-demand via Sonnet 4.6), full transcript

### Conversation Summaries

On-demand AI summaries generated via admin button click:
- Quiz: `POST /api/admin/results/summary` — includes quiz context (variant, answers, assessment)
- Chat: `POST /api/admin/chats/summary` — conversation-only context
- Both use Claude Sonnet 4.6, saved to respective storage records
- Quiz summaries included in admin PDF export (appears after AI Assessment section)

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
├── route.ts                          Streaming endpoint (Opus 4.6, dual-mode, caching, logging)
├── systemPrompt.ts                   Shared sections + buildAgentPrompt / buildStandalonePrompt
├── tools/
│   ├── index.ts                      Exports agentTools (search, read, extract_findings)
│   ├── searchTool.ts                 Exa semantic search (3 results, research paper)
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
└── route.ts                          POST endpoint for quiz tracking events + conversations

app/api/chat/engagement/
└── route.ts                          POST endpoint for standalone chat tracking

app/api/admin/
├── results/
│   ├── route.ts                      GET quiz submissions + engagement
│   ├── pdf/route.ts                  Admin PDF export (includes summary)
│   └── summary/route.ts             AI summary for quiz conversations
└── chats/
    ├── route.ts                      GET standalone chat sessions
    └── summary/route.ts             AI summary for standalone conversations

app/explore/[quizId]/                 Post-quiz agent
├── page.tsx                          Server component (validates quizId)
└── agent-page.tsx                    Client component (chat interface)

app/chat/                             Standalone chat agent
├── layout.tsx                        Server layout with metadata
├── page.tsx                          Client redirect to latest thread
└── [threadId]/
    ├── page.tsx                      Server component (key={threadId})
    └── chat-page.tsx                 Client component (chat + sidebar)

components/
├── ai-elements/
│   ├── conversation.tsx              Auto-scroll container
│   ├── message.tsx                   User/assistant bubbles
│   ├── response.tsx                  Markdown renderer
│   ├── tool-status.tsx               Research indicator
│   ├── sources.tsx                   Citation drawer
│   ├── reasoning.tsx                 Thinking block
│   ├── prompt-input.tsx              Text input + send/stop
│   └── loader.tsx                    Loading spinner
└── chat-sidebar.tsx                  Thread list sidebar (CRUD, rename, delete)

hooks/
├── use-agent-persistence.ts          Post-quiz IndexedDB + server persistence
├── use-chat-persistence.ts           Standalone chat IndexedDB + server persistence
└── use-mobile.ts                     Mobile detection

lib/
├── agent/thread-store.ts             Post-quiz Dexie store (keyed by quizId)
├── chat/thread-store.ts              Standalone Dexie store (threads + messages)
├── tracking.ts                       Fire-and-forget tracking (quiz + chat)
└── message-utils.ts                  Text extraction + citation URL parsing

server/
├── quizEngagement.ts                 Quiz engagement storage (Redis/filesystem)
└── chatSessions.ts                   Standalone chat storage (Redis/filesystem)
```

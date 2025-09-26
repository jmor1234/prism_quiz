# app/chat/directory-structure.md

**Bioenergetic UI Integration**: The frontend reflects the system's specialization in tracing health symptoms to root causes through energy metabolism. Key UI elements reinforce this worldview through subtle branding, specialized placeholders, and bioenergetic phase descriptions.

app/chat/
│
├── layout.tsx                  # App shell for the chat UI
│                               # - SidebarProvider + AppSidebar + SidebarInset
│                               # - Cookie-backed open/closed state
│                               # - Wraps dynamic routes and composers
│
├── page.tsx                    # /chat entry route
│                               # - Redirects to latest thread or creates a new one
│                               # - Pairs with next.config.ts redirect for robustness
│
├── page.client.tsx             # Client wrapper for the /chat entry
│                               # - Client-side helpers (SSR boundary)
│
├── [threadId]/
│   └── page.tsx                # Dynamic route: renders a client chat pane for a thread
│                               # - Hydrates messages from IndexedDB via thread-store
│                               # - Renders <ThreadChat /> with streaming UI
│
├── thread-chat.tsx             # Main chat orchestrator (client component)
│                               # - useChat() from AI SDK UI (streaming state machine)
│                               # - onData callback handles research progress data parts
│                               # - ResearchState management (session/objectives/phases/collections/sources)
│                               # - **Context warning state**: Local state for persistent token warnings (70k/85k/95k/100k)
│                               # - **Context warning banner**: Color-coded (yellow/orange/red) with token count and "Start New Thread" button
│                               # - **Error recovery**: dismissedError state; handleRetry extracts last user message (text+files) and resends
│                               # - useMessageVisibility(): latest user→assistant pair focus
│                               # - Message editing & branching (user + assistant)
│                               # - Saves UIMessage[] snapshots to Dexie on completion
│                               # - Rehydrates on thread load/switch
│                               # - Empty state: "Your bioenergetic research agent"
│
└── components/                 # Chat-local UI pieces
    ├── chat-composer.tsx       # Bottom composer (attachments, voice, theme toggle)
    │                           # - Bioenergetic placeholders:
    │                           #   • Hero: "Ask about symptoms, conditions, or health connections..."
    │                           #   • Regular: "Continue exploring..."
    ├── attachment-button.tsx   # Opens file dialog and wires into attachment context
    ├── voice-button.tsx        # Mic capture → /api/transcribe → inserts text
└── message-renderer.tsx    # Renders message parts (text, reasoning, file) using markdown; inline citations are standard [Title](URL) links (no claim-span overlays)

---

## Shared UI and primitives

components/
│
├── app-sidebar.tsx             # Thread list + actions + Bioenergetic branding
│                               # - Energy gradient icon with "Bioenergetic" label
│                               # - Properly centers in collapsed state
│
├── ai-elements/                # Streaming-aware building blocks (used by chat UI)
│   ├── conversation.tsx        # Provides chat container + context
│   ├── message.tsx             # Role-aware container + hover actions
│   ├── response.tsx            # Streams assistant text (markdown renderer)
│   ├── reasoning.tsx           # Streams visible reasoning (auto-open/close)
│   ├── tool.tsx                # (Private) tool parts, not rendered by default
│   ├── tool-status.tsx         # Lightweight transient tool/planning status (slide/fade, spinner or dots)
│   ├── prompt-input.tsx        # Attachment context; clipboard/drag-drop; image compression
│   ├── code-block.tsx          # Code fences with copy
│   ├── sources.tsx             # Sources drawer (All research sources); favicon + [Title](URL)
│   └── … (others)              # actions, artifact, branch, image, etc.
│
├── research-progress.tsx       # Task-based research pipeline (Pipeline/Details toggle)
│                               # - Pipeline: Objective step (objective + chips for key entities, focus areas, categories)
│                               #            Query-generation displays query chips with "Show all" → Details
│                               #            Searching displays summary chips (queries|hits|unique) and sample domains
│                               # - Details: ObjectiveDetails shows full objective text and full lists
│                               # - Multiple objectives can be open simultaneously; calm defaults for concurrency
│                               # - Bioenergetic phase labels:
│                               #   • "Exploring connections" (query generation)
│                               #   • "Gathering evidence" (searching)
│                               #   • "Tracing energy cascades" (analyzing)
│                               #   • "Connecting root causes" (consolidating)
│                               #   • "Revealing bioenergetic patterns" (synthesizing)
│
├── extraction-progress.tsx     # Task-based extraction progress component
│                               # - Shows extraction session (X/Y URLs) as URL rows inside a Task
│
├── error-banner.tsx            # Error recovery UI component
│                               # - Classifies errors: transient (overload, timeout, network) vs permanent (context limit, auth)
│                               # - Transient: yellow/orange banner with Retry button
│                               # - Permanent: red banner, no retry (would fail again)
│                               # - Positioned above composer for immediate visibility after send
│
├── app-sidebar.tsx             # Thread list + actions (New, Rename, Delete, Delete all)
└── ui/                         # shadcn/ui primitives (button, input, sheet, sidebar, etc.)

---

## Client-side data + utilities

lib/
│
├── thread-store.ts             # Dexie/IndexedDB persistence for UIMessage[] per threadId
│                               # - create/list/load/save/rename/delete/deleteAll
│                               # - Snapshots saved after status==='ready'
│
├── streaming-types.ts          # TypeScript types for all tool progress streaming
│                               # - Research types: ResearchSessionData, ResearchObjectiveData, ResearchPhaseData
│                               # - Extraction types: ExtractionSessionData, ExtractionUrlData
│                               # - Tool status types: ToolStatusData for simple tools
│                               # - **Context warning types**: ContextWarningData (level, persistentTokens, message, timestamp)
│                               # - Transient types: ResearchOperationData, SearchProgressData, ResearchErrorData
│                               # - ResearchUIMessage type with complete data part schemas
│                               # - ResearchState for comprehensive frontend state management (excludes contextWarning)
│
├── message-utils.ts            # UIMessage content extraction utilities
│                               # - extractMessageText: text parts only (excludes reasoning)
│                               # - extractMessageFiles: file parts only
│                               # - extractMessageContent: both text+files for retry
└── utils.ts                    # Generic helpers

app/
├── layout.tsx                  # Root layout with bioenergetic metadata
│                               # - Title: "Bioenergetic Research System"
│                               # - Description: Health tracing through energy cascades
└── globals.css                 # Global styles + custom animations
                               # - shimmer animation for progress bars
                               # - animation delays for staggered effects
                               # - Bioenergetic cascade color variables (root→symptom gradient)

hooks/
└── use-mobile.ts               # Mobile detection helpers for responsive behaviors

---

## Execution flow (frontend)
1) Navigate to /chat → redirect to latest or create new → /chat/[threadId]
2) layout.tsx renders shell (sidebar + content area)
3) [threadId]/page.tsx renders <ThreadChat />
4) ThreadChat uses useChat() to send messages and stream parts back (text, reasoning, files)
5) AI Elements render streaming parts; message actions (copy/edit) are hover-revealed and streaming-safe
6) On completion (status==='ready'), snapshot UIMessage[] to IndexedDB via thread-store
7) Rehydrate snapshots on load/switch; edits truncate/branch per AI SDK v5 patterns

---

## Message presentation & UX
- Asymmetric layout: user bubbles (right, padded), assistant document style (left, padded)
- Pair isolation: only latest user→assistant exchange is visible by default; toggle to show previous
- Empty state: hero composer centered; bottom composer appears after first message
- Images: shown via file parts; Next/Image (unoptimized for data URLs); width‑bounded and rounded
- Voice: mic → MediaRecorder → /api/transcribe → text inserted, then normal flow

---

## Multimodal & attachments
- Attachments flow through AI Elements context (no prop drilling)
- Images are converted to base64 data URLs; large images are compressed (max ~1920px, JPEG ~0.8)
- Pasted screenshots and drag‑drop supported; attachments displayed immediately via blob URL, then converted

---

## Streaming & editing safety
- useChat() manages streaming states (idle→loading→streaming→idle)
- Edit controls hidden while streaming; single edit active at a time
- Copy excludes reasoning by default; citations rendered via ai-elements/sources when present
- Planning gaps are covered by `ToolStatus` with a 200 ms deferred show to avoid flash; exits animate
- **Error recovery**: transient errors show banner above composer with one-click retry; permanent errors show dismissal only; errors auto-clear on new stream

---

## Notes
- The backend exposes visible reasoning (Anthropic); frontend renders it via <Reasoning> parts
- Tool calls are private by default and not rendered; their effects are reflected in the final text & citations
- Frontend does not persist partial streams; only finalized snapshots are saved

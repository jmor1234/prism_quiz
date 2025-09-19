# app/chat/directory-structure.md

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
│                               # - ResearchState management (session/objectives/phases/collections/sources/claimSpans)
│                               # - useMessageVisibility(): latest user→assistant pair focus
│                               # - Message editing & branching (user + assistant)
│                               # - Saves UIMessage[] snapshots to Dexie on completion
│                               # - Rehydrates on thread load/switch
│
└── components/                 # Chat-local UI pieces
    ├── chat-composer.tsx       # Bottom composer (attachments, voice, theme toggle)
    ├── attachment-button.tsx   # Opens file dialog and wires into attachment context
    ├── voice-button.tsx        # Mic capture → /api/transcribe → inserts text
    └── message-renderer.tsx    # Renders message parts (text, reasoning, file)

---

## Shared UI and primitives

components/
│
├── ai-elements/                # Streaming-aware building blocks (used by chat UI)
│   ├── conversation.tsx        # Provides chat container + context
│   ├── message.tsx             # Role-aware container + hover actions
│   ├── response.tsx            # Streams assistant text
│   ├── reasoning.tsx           # Streams visible reasoning (auto-open/close)
│   ├── tool.tsx                # (Private) tool parts, not rendered by default
│   ├── prompt-input.tsx        # Attachment context; clipboard/drag-drop; image compression
│   ├── code-block.tsx          # Code fences with copy
│   ├── sources.tsx             # Citations rendering
│   └── … (others)              # actions, artifact, branch, image, etc.
│
├── research-progress.tsx       # Task-based research pipeline (Pipeline/Details toggle)
│                               # - Pipeline: ChainOfThought narrative (default open), chips & metrics
│                               # - Details: ObjectiveDetails (legacy-style full view) on demand
│                               # - One active objective auto-open; calm defaults for concurrency
│
├── extraction-progress.tsx     # Task-based extraction progress component
│                               # - Shows extraction session (X/Y URLs) as URL rows inside a Task
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
│                               # - Transient types: ResearchOperationData, SearchProgressData, ResearchErrorData
│                               # - ResearchUIMessage type with complete data part schemas
│                               # - ResearchState for comprehensive frontend state management
│
├── message-utils.ts            # UIMessage text extraction (excludes reasoning where needed)
└── utils.ts                    # Generic helpers

app/
└── globals.css                 # Global styles + custom animations
                               # - shimmer animation for progress bars
                               # - animation delays for staggered effects

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

---

## Notes
- The backend exposes visible reasoning (Anthropic); frontend renders it via <Reasoning> parts
- Tool calls are private by default and not rendered; their effects are reflected in the final text & citations
- Frontend does not persist partial streams; only finalized snapshots are saved

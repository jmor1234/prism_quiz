# Frontend Directory Structure

```
app/
├── layout.tsx                      # Root layout — Geist fonts, "Prism Health" metadata, viewport, ThemeProvider
├── page.tsx                        # Server redirect → /chat
├── globals.css                     # Tailwind v4 + ShadCN theme + Streamdown typography + animations
├── favicon.ico
├── chat/
│   ├── layout.tsx                  # Server component — SidebarProvider (cookie-based), AppSidebar, SidebarInset
│   ├── page.tsx                    # Client redirect → latest thread or create new
│   └── [threadId]/
│       ├── page.tsx                # Server component — awaits params, renders ChatPage with key={threadId}
│       └── chat-page.tsx           # Client component — usePersistedChat → ChatView
├── sim/
│   ├── layout.tsx                  # Server component — SimGateLoader + SidebarProvider + AppSidebar
│   ├── page.tsx                    # Client redirect → latest sim thread or create new
│   └── [threadId]/
│       ├── page.tsx                # Server component — awaits params, renders SimPage with key={threadId}
│       └── sim-page.tsx            # Client component — usePersistedChat + auto-play loop + sim controls
├── components/
│   ├── message-renderer.tsx        # Part dispatcher: text→Response, reasoning→Reasoning, file→Image
│   ├── chat-composer.tsx           # Composer (voice, attachments, submit morphing)
│   ├── voice-button.tsx            # MediaRecorder → /api/transcribe → textarea text injection
│   └── attachment-button.tsx       # File dialog trigger (uses AttachmentsContext)
└── api/
    ├── transcribe/
    │   └── route.ts                # Voice transcription (OpenAI Whisper API, direct REST)
    └── export-pdf/
        ├── route.ts                # PDF generation endpoint (markdown → HTML → PDF)
        └── lib/
            ├── markdownToHtml.ts   # unified pipeline (remark-parse → remark-gfm → remark-rehype → rehype-stringify)
            ├── generatePdf.ts      # Puppeteer headless Chrome → A4 PDF with try/finally cleanup
            └── pdfStyles.ts        # Print-optimized CSS (system fonts, code blocks, tables)

components/
├── ai-elements/
│   ├── loader.tsx                  # Vercel-style SVG spinner (opacity-graded spokes)
│   ├── conversation.tsx            # StickToBottom auto-scroll wrapper + scroll-to-bottom button
│   ├── message.tsx                 # Message + MessageContent (CVA variants: user bubbles, assistant flat)
│   ├── message-copy.tsx            # Copy button (extracts text parts, excludes reasoning)
│   ├── message-pdf-button.tsx      # PDF export button (POST markdown → blob download → <a> click)
│   ├── response.tsx                # Streamdown memo wrapper for streaming markdown rendering
│   ├── reasoning.tsx               # Collapsible thinking block (auto-open/close, duration tracking)
│   ├── tool-status.tsx             # Transient status indicator (gradient bg, slide-in animation)
│   ├── sources.tsx                 # Collapsible sources drawer (favicon, dedup, cap at 8)
│   └── prompt-input.tsx            # Compound input (AttachmentsContext, auto-resize, paste/drag-drop, submit morphing)
├── chat-view.tsx                   # Shared presentational chat UI — messages, tool status, sources, error, composer
├── app-sidebar.tsx                 # Thread list sidebar — CRUD, inline rename, hover-reveal actions
├── sim-gate.tsx                    # Sim password gate — useSyncExternalStore + sessionStorage
├── sim-gate-loader.tsx             # Client wrapper — next/dynamic({ ssr: false }) for SimGate
├── theme-provider.tsx              # next-themes wrapper (system/light/dark, localStorage persistence)
└── ui/                             # ShadCN primitives
    ├── button.tsx
    ├── collapsible.tsx
    ├── dropdown-menu.tsx
    ├── input.tsx
    ├── mode-toggle.tsx             # Dark mode toggle (Light/Dark/System dropdown, Sun/Moon icons)
    ├── scroll-area.tsx
    ├── separator.tsx
    ├── sheet.tsx                    # Radix dialog drawer (mobile sidebar)
    ├── sidebar.tsx                  # ShadCN sidebar — context, cookie state, mobile Sheet, collapsible modes
    ├── skeleton.tsx
    ├── textarea.tsx
    └── tooltip.tsx

hooks/
├── use-mobile.ts                   # Mobile detection (768px breakpoint, useEffect + matchMedia)
├── use-thread-persistence.ts       # Hydrate from IndexedDB on mount, save on stream completion
└── use-persisted-chat.ts           # useChat + useThreadPersistence combined — single hook for both routes

lib/
├── utils.ts                        # cn() + canonicalizeUrlForDedupe()
├── message-utils.ts                # extractMessageText() + extractCitationUrls()
└── thread-store.ts                 # Dexie/IndexedDB persistence — ThreadMeta + messages tables, CRUD, SSR-safe
```

## Architecture

### Routing & Persistence

Two sources of truth, zero state management libraries:

1. **URL** — active thread (`/chat/[threadId]` or `/sim/[threadId]`)
2. **IndexedDB** — thread metadata + message history (via Dexie)

```
/ → redirect → /chat → client redirect → /chat/[threadId]
/sim → password gate → client redirect → /sim/[threadId]
```

Thread data stored in a single Dexie database with `type: 'chat' | 'sim'` field. Each route's sidebar filters by type. Thread IDs are `thr_{nanoid(12)}`.

### Thread Persistence Layer (`lib/thread-store.ts`)

Pure async functions, SSR-safe (lazy Dexie init, all functions guard `if (!db) return`).

| Function | Behavior |
|---|---|
| `createThread(type)` | Generates ID, inserts meta + empty messages atomically |
| `saveMessages(threadId, messages)` | Derives title from first user message (80 chars), preview from last assistant (120 chars). Updates both tables atomically. |
| `loadMessages(threadId)` | Returns `UIMessage[]` (empty array if not found) |
| `listThreads(type)` | All `ThreadMeta[]` sorted by `updatedAt` DESC |
| `renameThread(id, title)` | Updates title field |
| `deleteThread(id)` | Deletes from both tables atomically |
| `getLatestThread(type)` | Most recently updated thread of given type |

### Hook Chain

```
usePersistedChat({ threadId })
  → useChat({ id: threadId, experimental_throttle: 50 })
  → useThreadPersistence({ threadId, messages, setMessages, status })
      → Hydrate from IndexedDB on mount
      → Save when status transitions from streaming/submitted → ready
  → Returns { messages, sendMessage, setMessages, status, stop, error, forceSave }
```

Both `/chat` and `/sim` routes call `usePersistedChat` directly, giving full access to all chat state. `ChatView` is purely presentational.

### Layout Structure

Both routes share the same layout pattern:

```
SidebarProvider (h-svh, overflow-hidden, defaultOpen from cookie)
  AppSidebar (threadType, basePath)
    SidebarHeader — New conversation button + ModeToggle
    SidebarContent — Thread list (CRUD, inline rename, hover-reveal actions)
  SidebarInset
    header (sticky, SidebarTrigger, backdrop-blur)
    content area (flex-1, min-h-0)
      ChatView or SimPage
```

Server component layouts read sidebar cookie for SSR → no hydration flash. `SidebarProvider` constrains to `h-svh overflow-hidden` so `Conversation`'s `overflow-y-auto` activates properly.

### Sidebar (`components/app-sidebar.tsx`)

- Accepts `threadType: ThreadType` and `basePath: string`
- Thread list loaded from IndexedDB, refreshed on pathname change
- New conversation: `createThread()` + `router.push()` wrapped in `startTransition`
- Delete: `confirm()` dialog, maintains "always at least one thread" invariant
- Inline rename: Enter commits, Escape cancels, blur commits
- Hover-reveal dropdown actions (rename, delete) via `SidebarMenuAction showOnHover`
- Mobile: sidebar renders as Sheet overlay (< 768px). Desktop: collapsible to 3rem icon strip
- Keyboard shortcut: Ctrl/Cmd+B toggles sidebar

### ChatView (`components/chat-view.tsx`)

Shared presentational component extracted from the original `page.tsx`. Receives all state as props:

- `messages`, `status`, `sendMessage`, `stop`, `error` — from `usePersistedChat`
- `hideComposer` — sim route hides composer (auto-play drives messages)
- `emptyStateContent` — custom empty state (sim uses "Select an archetype and hit Start")

Contains: `useMessageVisibility` hook, tool status derivation, message rendering loop, sources extraction, error banner, conditional `ChatComposer`.

### Thread Switching

`key={threadId}` on client components in the server page files forces full React remount on navigation. This guarantees clean state — no stale closures, no leftover messages from previous threads.

### Simulation Route

Password gate uses `useSyncExternalStore` to read `sessionStorage` (no hydration mismatch). Loaded via `SimGateLoader` with `next/dynamic({ ssr: false })` to avoid Radix ID mismatches from tree divergence.

After auth, sim route mirrors the chat route: same sidebar, same persistence. Sim-specific additions:

- **Control bar**: Archetype dropdown, Start/Pause/Resume/Stop buttons, turn counter, copy button
- **Auto-play loop**: After agent responds (`status === 'ready'`), 15s delay, then `POST /api/simulate` generates next prospect message → `sendMessage()` → cycle repeats
- **New simulation**: Creates a new thread + navigates (replaces old `chatKey` remount hack)
- **Turn limit**: 30 turns max

### `page.tsx` — Chat Orchestrator

The chat orchestration now lives in `chat-page.tsx` (client component inside `app/chat/[threadId]/`).

**Key patterns:**
- `usePersistedChat({ threadId })` — wraps `useChat` + IndexedDB persistence
- `sendMessage({ text, files? })` — sends user input + optional attachments to `/api/chat`
- `status` — `'submitted' | 'streaming' | 'ready' | 'error'`
- Messages persist across page refresh via IndexedDB
- Thread title auto-derived from first user message

**Opening flow:** Empty state displays "What's your biggest health struggle right now, or your most important health goal?" as UI text (not an agent message). The user types their answer and submits. The agent receives this as its first message — the system prompt tells the agent the UI already asked the question. No agent opening message; the first response engages directly with what they shared.

### Message Rendering

`message-renderer.tsx` dispatches on `message.parts`:
- `text` → `<Response>` (Streamdown markdown) for assistant, plain text for user
- `reasoning` → `<Reasoning>` (collapsible, auto-open during streaming, auto-close 1s after)
- `file` → `<Image>` (Next.js Image, unoptimized for data URLs)
- Tool parts → `null` (not rendered inline; tool status shown separately below messages)

### Tool Status Labels

Tool names map to UI labels in `chat-view.tsx`:

| Backend Tool Name | Frontend Label |
|-------------------|---------------|
| `retrieve_evidence` | "Researching" |
| `read_source` | "Reading source" |
| `extract_findings` | "Reading source" |
| `think` | "Thinking" |

Fallback for unmapped tools: `"Running ${name}"`

When no tool is active during streaming, a dots-only indicator (no text label) is shown.

### Styling Approach

- **Asymmetric messages**: User messages are contained bubbles (`bg-primary rounded-2xl`). Assistant messages are flat/document-style (`bg-transparent`).
- **CVA variants**: `is-user`/`is-assistant` CSS classes on outer div, `group-[.is-user]`/`group-[.is-assistant]` selectors on content.
- **Hover-reveal actions**: Copy + PDF buttons — `opacity-0 group-hover:opacity-100` on desktop, always visible on mobile.
- **Streamdown typography**: Styled via `[data-streamdown="..."]` CSS selectors in `globals.css`. Links are explicitly blue (`!important` to override Streamdown's inline `text-primary` class).

### Layout & Scroll

`SidebarProvider` constrains to `h-svh overflow-hidden`. `SidebarInset` fills remaining space. `Conversation` (StickToBottom) gets `flex-1 overflow-y-auto`. `ConversationContent` carries the `max-w-[var(--container-max-w)]` constraint and centering, keeping messages at 840px.

### Composer

Mobile `fixed bottom-0 left-0 right-0` with safe-area padding, desktop `sticky bottom-0` constrained to `--container-max-w: 840px`.

Two rows: auto-resize textarea on top, toolbar (attachment + voice buttons on left, submit/stop button on right) on bottom.

Placeholder text: "Share what's going on..."

Submit button morphs by status: Send icon → Spinner → Stop (square).

Supports: Enter to submit, Shift+Enter for newline, IME-aware, image paste from clipboard, drag-drop file upload.

### Voice Input

`voice-button.tsx` — Self-contained MediaRecorder component with 3-state lifecycle:
1. **Idle** — Gray mic icon. Click to start recording.
2. **Recording** — Red pulsing mic-off icon. Click to stop. MediaRecorder captures audio with codec detection (webm/opus preferred, mp4 fallback).
3. **Transcribing** — Spinner. Audio blob POSTed to `/api/transcribe`. Text injected into textarea via `onTranscription` callback.

Voice input is especially important for this use case — when people talk about their health instead of typing, they share more, self-edit less, and include emotional texture the agent can respond to.

Browser capability check via `useSyncExternalStore` (SSR returns `false`, client checks `MediaRecorder.isTypeSupported`). Button hidden on unsupported browsers without hydration mismatch.

`/api/transcribe` — Direct OpenAI Whisper REST API call. No `@ai-sdk/openai` dependency. Graceful 500 if `OPENAI_API_KEY` not configured.

### PDF Export

`message-pdf-button.tsx` — POSTs `extractMessageText(message)` to `/api/export-pdf`. Creates blob URL → triggers `<a>` click download → revokes URL. Loading spinner during generation.

`/api/export-pdf` pipeline:
1. `markdownToHtml.ts` — unified pipeline (remark-parse → remark-gfm → remark-rehype → rehype-stringify) wraps output in full HTML document with print CSS
2. `generatePdf.ts` — Puppeteer launches headless Chrome, renders HTML, generates A4 PDF with margins. `try/finally` ensures browser cleanup on error.
3. `pdfStyles.ts` — Print-optimized CSS (system font stack, heading hierarchy, code blocks, tables, blockquotes)
4. Filename extracted from first H1 in markdown via `extractH1ForFilename()`

Requires `serverExternalPackages: ["puppeteer"]` in `next.config.ts` to prevent Next.js from bundling Chromium.

### Dark Mode

Implemented via `next-themes` (ShadCN standard pattern):
- `ThemeProvider` wraps app in `layout.tsx` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`
- `suppressHydrationWarning` on `<html>` prevents flash
- `ModeToggle` dropdown with three options: Light, Dark, System
- Both routes: in sidebar header (next to "New conversation" button), hidden when sidebar is icon-collapsed
- Sim password gate: fixed top-right corner
- Theme persisted in localStorage, defaults to system preference

### Key Packages

| Package | Purpose |
|---------|---------|
| `dexie` | IndexedDB wrapper for thread/message persistence |
| `streamdown` | Streaming markdown rendering with `data-streamdown` attribute selectors |
| `use-stick-to-bottom` | Auto-scroll with smooth behavior, scroll-to-bottom button |
| `nanoid` | ID generation for thread IDs and attachment thumbnails |
| `class-variance-authority` | Message styling variants |
| `puppeteer` | Headless Chrome for PDF generation |
| `unified` + `remark-*` + `rehype-*` | Markdown → HTML pipeline for PDF export |
| `next-themes` | Dark mode (system/light/dark) with localStorage persistence |

### Deferred

- Research progress streaming (requires backend data part emission)
- Prism-specific branding/color adjustments

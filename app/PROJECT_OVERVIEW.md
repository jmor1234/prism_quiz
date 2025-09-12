# Project Overview

## Core Architecture

**This is a multimodal streaming AI reasoning system, not a traditional chat app.**

Key architectural principle: **Everything streams in real-time** - AI responses, reasoning process, visual analysis, and UI updates happen continuously, not in discrete request/response cycles. Users observe Claude's cognitive process as it analyzes both text and visual content.

## Tech Stack Deep Dive

### Layer 1: Vercel AI SDK v5 (The Streaming Engine)

**Core Concept**: Converts AI model responses into real-time streams of data chunks.

```javascript
// What streamText() does internally:
// 1. Sends request to AI provider (OpenAI, Anthropic, etc.)
// 2. Receives response as stream of tokens
// 3. Processes each token and yields it immediately
// 4. Handles provider differences behind a unified API

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  messages: [...],
  providerOptions: {
    anthropic: {
      thinking: { type: 'enabled', budgetTokens: 16000 } // Expose thinking process
    }
  }
});
```

**Key Innovation**: `toUIMessageStreamResponse({ sendReasoning: true })` converts the raw stream into structured message parts that can be consumed by React.

### Layer 2: AI SDK UI (The State Machine)

**Core Concept**: `useChat()` is a sophisticated state machine that manages streaming chat interactions.

**What it handles**:
- **Message ordering**: Ensures responses appear in correct sequence
- **Streaming states**: loading → streaming → complete → error
- **Optimistic updates**: Shows user input immediately, handles failures gracefully  
- **File integration**: Seamlessly includes attachments in message flow
- **Auto-retry**: Handles network failures and reconnections

```javascript
const { messages, status, sendMessage, stop } = useChat({
  experimental_throttle: 50  // Throttle UI updates for performance
});

// Status flow: 'idle' → 'loading' → 'streaming' → 'idle'
// Messages automatically update as streaming occurs
```

**Mental Model**: Think of it as managing a pipeline where user input flows to AI, AI streams back response parts, and UI updates continuously reflect the current state.

### Layer 3: AI Elements (The Streaming-Aware UI)

**Core Concept**: React components specifically designed for streaming AI interactions, built on shadcn/ui design system.

**Key Architectural Pattern**: Compound components that work together through React Context.

```javascript
// The component hierarchy creates structured chat layout:
<Conversation>                    // Provides chat container + context
  <ConversationContent>           // Manages scrolling + message layout
    <Message from="user|assistant">   // Individual message container + hover group
      <MessageContent message={message} onEdit={handleEdit}>  // Content + action buttons
        {editingMessageId === message.id ? (
          <MessageEditForm />     // Inline editing for user messages
        ) : (
          <>
            <Response>text content</Response>           // For text parts
            <Reasoning isStreaming={true}>             // For reasoning parts
              <ReasoningTrigger />  // Collapsible trigger
              <ReasoningContent />  // Reasoning text
            </Reasoning>
          </>
        )}
        // Hover-revealed action buttons below message content
        <MessageEditButton />     // Both user and assistant messages
        <MessageCopyButton />     // All messages
      </MessageContent>
    </Message>
  </ConversationContent>
</Conversation>
```

**Streaming Intelligence**: Components automatically adapt to streaming state:
- `<Reasoning>` auto-opens during streaming, auto-closes when complete
- `<Response>` updates incrementally as text streams in
- `<PromptInput>` manages file attachments through context
- `<MessageEditButton>` only appears when `status === 'ready'` (streaming-safe)
- `<MessageCopyButton>` + `<MessageEditButton>` reveal on hover for clean UX

**File System**: `<PromptInput>` provides attachment context that `<AttachmentButton>` consumes, creating seamless file integration without prop drilling.

### Layer 4: Client Persistence & Shell (v1)

- **Local thread persistence**: Dexie/IndexedDB stores complete `UIMessage[]` snapshots per `threadId` for finalized exchanges and assistant edits.
- **Thread shell**: shadcn/ui `SidebarProvider` + `Sidebar` (collapsible=icon) compose a persistent app shell. Open/closed state is cookie-backed.
- **Routing**: URL-based `/chat/[threadId]` (Next.js 15 dynamic params awaited); `/chat` redirects to the latest or creates a new thread. Root `/` redirects to `/chat` using `redirect()` in `app/page.tsx` with a matching redirect in `next.config.ts` for robustness.

### How The Three Layers Connect

**The Data Flow**:
```
User Input
  ↓ (useChat.sendMessage)
AI SDK streamText()
  ↓ (HTTP streaming)
useChat() state updates
  ↓ (React renders)
AI Elements components
  ↓ (Visual updates)
User sees streaming response
```

**The Key Insight**: Each layer handles one concern:
1. **AI SDK**: Raw AI provider communication + streaming
2. **AI SDK UI**: React state management + message handling  
3. **AI Elements**: Streaming-optimized UI components + UX patterns

This separation means you can swap AI providers (layer 1), change state management (layer 2), or redesign UI (layer 3) independently.

### Critical Implementation Details

**Reasoning System** (The app's key differentiator):
- **Backend**: `thinking: { type: 'enabled', budgetTokens: 16000 }` tells Claude Sonnet 4 to expose its thinking
- **Streaming**: Reasoning streams as a separate message part alongside the response
- **Frontend**: `<Reasoning>` components auto-manage UX (open while streaming, close with delay)
- **Result**: Users see *how* the AI thinks, not just *what* it concludes

**Message Parts Architecture**:
```javascript
// Traditional chat: message = string
// Our system: message = array of typed parts
UIMessage {
  parts: [
    { type: 'text', text: 'The answer is...', state: 'complete' },
    { type: 'reasoning', text: 'I need to think about...', state: 'streaming' },
    { type: 'file', url: 'data:image/png;base64,...', mediaType: 'image/png' } // Multimodal
  ]
}
```
This enables different parts to stream independently and render with specialized components. **File parts enable multimodal conversations** where images flow through the same streaming reasoning pipeline.

**Message Editing Architecture** (Conversation branching):
- **Edit Detection**: Both user and assistant messages show edit button on hover (streaming-safety enforced)
- **State Management**: Single edit state prevents multiple simultaneous edits
- **User Message Edit**: `stop()` → `setMessages(truncated)` → `sendMessage(editedText)` → new AI response (creates new branch)
- **AI Message Edit**: `stop()` → `setMessages(updated)` → no immediate response (rewrites history in-place)
- **Framework Alignment**: Uses AI SDK v5's intended pattern for message state manipulation
- **Smart Text Extraction**: `extractMessageText()` handles complex UIMessage parts filtering

**Voice Integration Pattern**:
1. `VoiceButton` → Browser MediaRecorder → audio blob
2. `/api/transcribe` → GPT-4o-transcribe → text
3. Text injection → normal chat flow
4. **Key insight**: Voice becomes text, then follows standard streaming path
5. **Critical fix**: Button remains clickable during recording (removed self-disabling behavior)

**File Attachment Context**:
- `<PromptInput>` creates attachment context
- `<AttachmentButton>` consumes context to open file dialog
- Files flow through the same streaming system as text
- **No prop drilling** - context eliminates passing file handlers down component tree

**Message Interaction System**:
- **Copy**: `MessageCopyButton` extracts text content (excludes reasoning) for clipboard
- **Edit**: `MessageEditButton` + `MessageEditForm` enables conversation branching
- **Smart extraction**: `lib/message-utils.ts` handles complex UIMessage part filtering
- **Streaming safety**: Edit operations are guarded during AI responses to prevent conflicts

**Message Pair Isolation (Viewport Focus)**:
- Implemented in `app/chat/thread-chat.tsx` via a `useMessageVisibility()` hook
- By default, only the latest user → assistant exchange is rendered; previous messages are temporarily hidden (not scrolled away)
- The reset trigger keys off the latest user message ID (not `messages.length`) so the view resets only when a new user message is sent (avoids spurious resets during truncation, edits, or non-user updates)
- A top-center toggle button allows users to show/hide previous messages on demand
- Benefits: cleaner focus, predictable behavior, and no scroll hacks; also reduces render work for long histories

```tsx
// Hook signature (simplified)
function useMessageVisibility(messages: UIMessage[]) {
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);

  // Reset only when a NEW user message appears
  const lastUserMessageId = useMemo(() => (
    [...messages].reverse().find(m => m.role === 'user')?.id ?? null
  ), [messages]);

  useEffect(() => {
    setShowPreviousMessages(false);
  }, [lastUserMessageId]);

  const visibleMessages = useMemo(() => {
    if (!messages.length || showPreviousMessages) return messages;
    const idx = messages
      .map((m, i) => ({ m, i }))
      .filter(x => x.m.role === 'user')
      .pop()?.i ?? 0;
    return messages.slice(idx);
  }, [messages, showPreviousMessages]);

  return { visibleMessages, hasPreviousMessages: messages.length > visibleMessages.length, showPreviousMessages, togglePreviousMessages: () => setShowPreviousMessages(v => !v) };
}

// Minimal usage
const { visibleMessages, hasPreviousMessages, showPreviousMessages, togglePreviousMessages } = useMessageVisibility(messages);
```

When to extend: add a `preserveState` option only if you later support pagination/tool messages or other updates where you do not want the view to reset.

**Asymmetric Message Presentation**:
- User messages: right-aligned bubbles with full width availability, `py-2` padding, 15px medium-weight font
- Assistant messages: flat document-style with `pl-6` left padding for proper list marker rendering
- Both message types use full container width (`max-w-3xl`) for improved readability
- Copy button positioned below messages on hover for both types
- Chat container width increased to `max-w-3xl` for improved readability; composer top border removed for a seamless, modern look

**Empty/New Chat State (Hero Composer)**:
- When there are no messages, `ConversationEmptyState` renders a centered hero with the heading “What are you working on?” and a single input. The regular bottom composer is hidden until there is at least one message.
- Vertical centering uses a min viewport height grid (`min-h-[60svh] grid place-items-center`).
- Widths are widened in empty state for a welcoming feel: outer container `max-w-[58rem]`, inner hero composer `max-w-[52rem]`.
- `ChatComposer` supports a `variant="hero"` that adjusts placeholder, sizing, and theming.
  - Light mode: subtle border (`border-black/15`) with `shadow-md`; submit button is black with white icon/text.
  - Dark mode: softer treatment (`border-white/10` + `ring-1 ring-inset ring-white/5`) and `shadow-sm`; submit button flips to white with black icon/text.
- Only one input is shown at a time: the hero input in empty state, or the bottom composer once messages exist.

Minimal structure (simplified):
```tsx
return (
  <Conversation className={empty ? "max-w-[58rem]" : "max-w-3xl"}>
    <ConversationContent>
      {empty ? (
        <ConversationEmptyState>
          <div className="min-h-[60svh] grid place-items-center text-center">
            <h1>What are you working on?</h1>
            <ChatComposer variant="hero" ... />
          </div>
        </ConversationEmptyState>
      ) : (
        /* normal message rendering */
      )}
    </ConversationContent>
  </Conversation>

  {/* bottom composer only after first message */}
  {!empty && <ChatComposer ... />}
)
```

## Multimodal Streaming Intelligence

**Core Innovation**: Images flow through the same streaming reasoning pipeline, enabling **visual cognitive transparency**.

### **Image Upload & Processing Architecture**

**Upload Methods**:
- **File button**: Standard file dialog for image selection
- **Screenshot paste**: Direct clipboard paste (`Ctrl/Cmd+V`) into textarea
- **Drag & drop**: Global drop support on chat interface

**Processing Pipeline**:
```javascript
// 1. File/paste → File object
// 2. Immediate UI display → blob URL (temporary)
// 3. Background conversion → base64 data URL (server-compatible)
// 4. Smart compression → if >2MB, compress to AI-optimal size
// 5. Message transmission → base64 flows to backend
// 6. AI analysis → Claude processes with streaming reasoning
```

**Key Technical Decisions**:

**Base64 Data URLs (Not Blob URLs)**:
- **Problem**: Blob URLs (`blob:http://localhost:3000/...`) only exist in browser context
- **Solution**: Convert to base64 data URLs (`data:image/png;base64,...`) that work server-side
- **Benefit**: Universal compatibility, no server-side file handling complexity

**Adaptive Image Compression**:
- **Small images** (<2MB): Preserve original quality
- **Large images** (>2MB): Compress using Canvas API to 1920px max, 0.8 JPEG quality  
- **AI-optimized**: Maintains text clarity while reducing file size 60-80%
- **Production-ready**: Eliminates request size limit issues

### **Streaming Visual Reasoning**

**The Breakthrough**: Users observe Claude analyzing images in real-time.

**Flow**:
```
User pastes screenshot
  ↓ (immediate attachment display)
Sends message with image + text
  ↓ (AI SDK processes multimodal input)
Claude streams visual analysis
  ↓ (reasoning panel auto-opens)
User sees "I can see this screenshot shows..." 
  ↓ (streaming cognitive process)
Reasoning auto-closes when complete
```

**Message Parts Integration**:
- **User message**: `{ type: 'file' }` part displays uploaded image
- **AI response**: `{ type: 'text' }` + `{ type: 'reasoning' }` parts analyze the visual content
- **Conversation branching**: Edit image messages to explore different visual interpretations

### **Implementation Details**

**Frontend** (`components/ai-elements/prompt-input.tsx`):
- **Clipboard handling**: Detects pasted images in `PromptInputTextarea.handlePaste()`
- **File conversion**: `compressImageIfNeeded()` handles size optimization
- **State management**: Atomic updates prevent duplicate attachments
- **Context integration**: Uses existing `AttachmentsContext` pattern

**Backend** (`app/api/chat/route.ts`):
- **No changes required**: Claude Sonnet 4 supports vision natively
- **AI SDK compatibility**: `convertToModelMessages()` handles file parts automatically
- **Streaming preserved**: Images + reasoning stream together seamlessly

**UI Components**:
- **MessageRenderer**: Added `case "file"` with Next.js `<Image>` optimization
- **Image display**: Max 384px width, rounded borders, filename labels
- **Responsive**: Works on mobile and desktop equally well

## What Our Code Does

### Backend
- **`/api/chat`**: Streams AI responses with reasoning enabled (Claude Sonnet 4 with vision)
- **`/api/transcribe`**: Converts audio to text using `gpt-4o-transcribe`

### Frontend
- **`app/chat/layout.tsx`**: App shell with `SidebarProvider`, `AppSidebar`, `SidebarTrigger`, and `SidebarInset`
- **`app/chat/[threadId]/page.tsx`**: Dynamic route that renders a client chat pane for a given `threadId`
- **`app/chat/thread-chat.tsx`**: Main chat pane with message editing, pair isolation, and local persistence hydration
- **`app/chat/components/`**: Core chat components
  - `ChatComposer`: Input with attachments + voice + dark mode toggle
  - `VoiceButton`: Records audio → transcribes → inserts text
  - `AttachmentButton`: File uploads via AI Elements context
  - `MessageRenderer`: Displays text + reasoning + image parts
- **`components/ai-elements/`**: Extended with message interaction + multimodal support
  - `prompt-input.tsx`: Image compression, clipboard paste, base64 conversion
  - `message-copy.tsx`: Copy message text (excludes reasoning)
  - `message-edit.tsx`: Edit user messages with conversation branching (supports images)
  - `message.tsx`: Role-aware styling (user = bubble, assistant = flat) + hover-revealed actions
- **`lib/message-utils.ts`**: Shared utilities for UIMessage text extraction
- **`components/app-sidebar.tsx`**: Thread list with New, Rename, Delete actions
- **`lib/thread-store.ts`**: Dexie-powered local persistence (create/list/load/save/rename/delete)

## Key Data Flows

**Chat**: User input → `useChat.sendMessage()` → `/api/chat` → `streamText()` → streaming UI updates
  - After completion (`status === 'ready'`), `UIMessage[]` snapshot is saved to IndexedDB (per `threadId`)
  - On load/switch, hydrate messages from IndexedDB to `useChat` state

**Voice**: Click mic → record audio → `/api/transcribe` → `gpt-4o-transcribe` → text inserted in input

**Images**: 
- Upload: Click + → file dialog → compression → base64 conversion → included in message
- Paste: Screenshot → `Ctrl/Cmd+V` → clipboard detection → compression → base64 conversion → included in message
- Analysis: Image + text → `/api/chat` → Claude vision analysis → streaming reasoning about visual content

**Copy**: Hover message → copy button → `extractMessageText()` → clipboard API → user notification

**Edit**: 
- User messages: Hover → edit button → `MessageEditForm` → save → `stop()` + `setMessages(truncated)` + `sendMessage()` → new AI response (supports image messages)
- Assistant messages: Hover → edit button → `MessageEditForm` → save → `stop()` + `setMessages(updated)` → history rewritten (no immediate response)

**Viewport focus**: On submit, the view resets to the latest user message at the top-right and reserves the remaining space for the incoming assistant response; a toggle reveals earlier history when needed

## Message Format

**Key Innovation**: Messages are composed of streaming parts, not single text blocks.

```typescript
UIMessage {
  parts: [
    { type: 'text', text: '...' },
    { type: 'reasoning', text: '...' },  // AI's thinking process
    { type: 'file', url: 'data:image/png;base64,...', mediaType: 'image/png' }  // Multimodal
  ]
}
```

**Why this matters**: Each part can stream independently and render with different UI components. Reasoning shows *how* the AI thinks, not just *what* it concludes. **File parts enable visual reasoning** - users see Claude analyzing images in real-time.

**Backend**: Claude Sonnet 4 with vision processes images + reasoning streams separately  
**Frontend**: `<Reasoning>` components auto-open during streaming, `<Image>` components display uploaded content

## For New Engineers

**Start here**: 
1. `app/chat/thread-chat.tsx` - `useChat()` + `useMessageVisibility()` + local persistence orchestration
2. `app/chat/layout.tsx` / `components/app-sidebar.tsx` - App shell + threads UI
3. `app/api/chat/route.ts` - Streaming backend (multimodal)
4. `components/ai-elements/prompt-input.tsx` - Image compression, clipboard paste, file handling
5. `components/ai-elements/message-renderer.tsx` - Rendering text, reasoning, image parts
6. `lib/message-utils.ts` - UIMessage text extraction patterns
7. `lib/thread-store.ts` - Dexie/IndexedDB persistence interface

**Key mental models**: 
- **Streaming parts** not "complete messages" - text, reasoning, and images all stream independently
- **Multimodal reasoning** - images flow through the same cognitive transparency pipeline
- **Message interaction safety** - operations are guarded during streaming states
- **Conversation branching** - editing creates new conversation paths (supports visual content exploration)
- **Smart extraction** - reasoning, response content, and visual content are handled separately
- **Base64 universality** - images travel as data URLs for browser/server compatibility

### Persistence v1 (Local) → v2 (Server) Upgrade Path
- v1 stores full `UIMessage[]` snapshots in IndexedDB (per-device). No cross-device sync; subject to browser quota.
- v2 will mirror the same interface on the server using AI SDK v5 `toUIMessageStreamResponse({ onFinish, generateMessageId })` and `consumeStream` to finish responses on disconnect.

# Project Overview

## Core Architecture

**This is a streaming AI reasoning system, not a traditional chat app.**

Key architectural principle: **Everything streams in real-time** - AI responses, reasoning process, and UI updates happen continuously, not in discrete request/response cycles.

## Tech Stack Deep Dive

### Layer 1: Vercel AI SDK v5 (The Streaming Engine)

**Core Concept**: Converts AI model responses into real-time streams of data chunks.

```javascript
// What streamText() does internally:
// 1. Sends request to AI provider (OpenAI, Anthropic, etc.)
// 2. Receives response as stream of tokens
// 3. Processes each token and yields it immediately
// 4. Handles provider differences behind unified API

const result = streamText({
  model: openai('gpt-5'),
  messages: [...],
  providerOptions: {
    openai: {
      reasoningEffort: 'high',        // Request AI's thinking process
      include: ['reasoning.encrypted_content']  // Include reasoning in stream
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
        // Hover-revealed action buttons (edit for users, copy for all)
        <MessageEditButton />     // User messages only
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
- **Backend**: `reasoningEffort: 'high'` tells GPT-5 to expose its thinking process
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
    { type: 'reasoning', text: 'I need to think about...', state: 'streaming' }
  ]
}
```
This enables different parts to stream independently and render with specialized components.

**Message Editing Architecture** (Conversation branching):
- **Edit Detection**: Only user messages show edit button on hover (streaming-safety enforced)
- **State Management**: Single edit state prevents multiple simultaneous edits
- **Conversation Branching**: `stop()` → `setMessages(truncated)` → `sendMessage(editedText)` → new AI response
- **Framework Alignment**: Uses AI SDK v5's intended pattern for message state manipulation
- **Smart Text Extraction**: `extractMessageText()` handles complex UIMessage parts filtering

**Voice Integration Pattern**:
1. `VoiceButton` → Browser MediaRecorder → audio blob
2. `/api/transcribe` → GPT-4o-transcribe → text
3. Text injection → normal chat flow
4. **Key insight**: Voice becomes text, then follows standard streaming path

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

## What Our Code Does

### Backend
- **`/api/chat`**: Streams AI responses with reasoning enabled (`gpt-5`)
- **`/api/transcribe`**: Converts audio to text using `gpt-4o-transcribe`

### Frontend
- **`app/chat/page.tsx`**: Main chat interface with message editing state management
- **`app/chat/components/`**: Core chat components
  - `ChatComposer`: Input with attachments + voice + dark mode toggle
  - `VoiceButton`: Records audio → transcribes → inserts text
  - `AttachmentButton`: File uploads via AI Elements context
  - `MessageRenderer`: Displays text + reasoning parts
- **`components/ai-elements/`**: Extended with message interaction
  - `message-copy.tsx`: Copy message text (excludes reasoning)
  - `message-edit.tsx`: Edit user messages with conversation branching
  - `message.tsx`: Enhanced with hover-revealed action buttons
- **`lib/message-utils.ts`**: Shared utilities for UIMessage text extraction

## Key Data Flows

**Chat**: User input → `useChat.sendMessage()` → `/api/chat` → `streamText()` → streaming UI updates

**Voice**: Click mic → record audio → `/api/transcribe` → `gpt-4o-transcribe` → text inserted in input

**Files**: Click + → file dialog → AI Elements context → included in message

**Copy**: Hover message → copy button → `extractMessageText()` → clipboard API → user notification

**Edit**: Hover user message → edit button → `MessageEditForm` → save → `stop()` + `setMessages()` + `sendMessage()` → new AI response

## Message Format

**Key Innovation**: Messages are composed of streaming parts, not single text blocks.

```typescript
UIMessage {
  parts: [
    { type: 'text', text: '...' },
    { type: 'reasoning', text: '...' }  // AI's thinking process
  ]
}
```

**Why this matters**: Each part can stream independently and render with different UI components. Reasoning shows *how* the AI thinks, not just *what* it concludes.

Backend: `reasoningEffort: 'high'` requests GPT-5's thinking process  
Frontend: `<Reasoning>` components auto-open during streaming, auto-close when complete

## For New Engineers

**Start here**: 
1. `app/chat/page.tsx` - See how `useChat()` + message editing orchestrates everything
2. `app/api/chat/route.ts` - Understand the streaming backend
3. `components/ai-elements/` - Explore the UI component library + message interactions
4. `lib/message-utils.ts` - Understand UIMessage text extraction patterns

**Key mental models**: 
- **Streaming parts** not "complete messages" - every interaction streams in real-time
- **Message interaction safety** - operations are guarded during streaming states
- **Conversation branching** - editing creates new conversation paths via framework-aligned patterns
- **Smart extraction** - reasoning vs response content are handled separately

# Project Overview

## Tech Stack

### Vercel AI SDK v5
- **Purpose**: Unified API for AI providers (OpenAI, Anthropic, etc.)
- **Key Feature**: Streaming responses with `streamText()`
- **Our Usage**: `app/api/chat/route.ts` uses `streamText()` with `gpt-5` model

### AI SDK UI  
- **Purpose**: React hooks for chat state management
- **Key Hook**: `useChat()` manages messages, status, streaming
- **Our Usage**: `app/chat/page.tsx` uses `useChat()` for all chat state

### AI Elements
- **Purpose**: Pre-built React components for AI apps (built on shadcn/ui)
- **Key Components**: `Conversation`, `Message`, `Response`, `Reasoning`, `PromptInput`
- **Our Usage**: All UI components in `components/ai-elements/`

## What Our Code Does

### Backend
- **`/api/chat`**: Streams AI responses with reasoning enabled (`gpt-5`)
- **`/api/transcribe`**: Converts audio to text using `gpt-4o-transcribe`

### Frontend
- **`app/chat/page.tsx`**: Main chat interface (orchestrates state only)
- **`app/chat/components/`**: Modular components
  - `ChatComposer`: Input with attachments + voice
  - `VoiceButton`: Records audio → transcribes → inserts text
  - `AttachmentButton`: File uploads via AI Elements context
  - `MessageRenderer`: Displays text + reasoning parts

## Key Data Flows

**Chat**: User input → `useChat.sendMessage()` → `/api/chat` → `streamText()` → streaming UI updates

**Voice**: Click mic → record audio → `/api/transcribe` → `gpt-4o-transcribe` → text inserted in input

**Files**: Click + → file dialog → AI Elements context → included in message

## Message Format
```typescript
UIMessage {
  parts: [
    { type: 'text', text: '...' },
    { type: 'reasoning', text: '...' }  // AI's thinking process
  ]
}
```

Reasoning is enabled backend (`reasoningEffort: 'high'`) and auto-rendered frontend in collapsible components.

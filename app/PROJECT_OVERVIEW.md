# Agentic Research Core - Project Overview

## What This Project Is

A full-stack TypeScript Next.js chat application that demonstrates modern AI integration patterns using the Vercel AI SDK ecosystem. The app provides a clean, minimal chat interface with advanced features like voice transcription and file attachments.

## Core Technologies

### Vercel AI SDK (Core)
**Purpose**: Unified abstraction layer for AI model providers and operations.

**Key Concepts**:
- **Provider Abstraction**: Single API to work with OpenAI, Anthropic, Google, etc.
- **Streaming Support**: Real-time text and data streaming from AI models
- **Type Safety**: Full TypeScript support with proper inference
- **Message Normalization**: Standardized message format across providers

**In Our Code**:
```typescript
// Backend: app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = streamText({
  model: openai('gpt-5'),
  messages: convertToModelMessages(messages),
  // Returns streaming response
});
```

### AI SDK UI (Frontend Hooks)
**Purpose**: React hooks for managing AI chat state and streaming.

**Key Concepts**:
- **`useChat`**: Manages chat messages, status, and streaming
- **Message Parts**: Each message can have multiple parts (text, reasoning, tools)
- **Streaming State**: Handles loading, error, and streaming states automatically
- **File Support**: Built-in support for file attachments in messages

**In Our Code**:
```typescript
// Frontend: app/chat/page.tsx
import { useChat } from "@ai-sdk/react";

const { messages, status, sendMessage, stop, error } = useChat({
  experimental_throttle: 50, // Throttle updates for performance
});
```

### AI Elements (UI Components)
**Purpose**: Pre-built, customizable React components for AI applications.

**Key Concepts**:
- **Built on shadcn/ui**: Modern, accessible component primitives
- **AI-Native Design**: Components designed specifically for AI interactions
- **Full Customization**: Copy components into your project, modify as needed
- **Message System**: Components that understand AI SDK message structure

**In Our Code**:
```typescript
// Components we use:
import {
  Conversation,           // Chat container
  Message,               // Individual message wrapper
  Response,              // Text response display
  Reasoning,             // Collapsible reasoning display
  PromptInput,           // Advanced input with attachments
} from "@/components/ai-elements/...";
```

## Current Application Architecture

### Backend (`/api` routes)

#### 1. Chat Route (`/api/chat/route.ts`)
- **Purpose**: Main chat endpoint that processes messages and streams AI responses
- **Model**: Uses `gpt-5` with reasoning capabilities enabled
- **Features**:
  - Reasoning output with `reasoningEffort: 'high'`
  - Streaming responses via `toUIMessageStreamResponse`
  - File attachment support through `convertToModelMessages`

#### 2. Transcription Route (`/api/transcribe/route.ts`)
- **Purpose**: Voice-to-text conversion using OpenAI's latest transcription model
- **Model**: Uses `gpt-4o-transcribe` (2025 model, superior to Whisper-1)
- **Process**: FormData audio → ArrayBuffer → AI SDK → transcribed text

### Frontend Architecture

#### Main Page (`app/chat/page.tsx`)
**Role**: State orchestration and layout only (50 lines)
- Manages chat state with `useChat`
- Renders conversation layout
- Delegates all complex logic to child components

#### Modular Components (`app/chat/components/`)

##### 1. `ChatComposer`
- **Purpose**: Complete input composition experience
- **Features**: Text input, file attachments, voice recording, send button
- **Integration**: Handles form submission and clearing

##### 2. `VoiceButton`
- **Purpose**: Voice recording and transcription
- **States**: Idle → Recording (red) → Transcribing (blue spinner) → Idle
- **Process**: MediaRecorder → Blob → API → Text insertion

##### 3. `AttachmentButton`
- **Purpose**: File attachment via AI Elements context system
- **Integration**: Uses `usePromptInputAttachments` hook

##### 4. `MessageRenderer`
- **Purpose**: Renders different message part types
- **Supports**: Text responses and reasoning blocks

## Key Data Flow Patterns

### 1. Message Flow (User → AI)
```
User Input → ChatComposer → useChat.sendMessage → /api/chat → streamText → AI Model
                                                              ↓
UI Updates ← AI SDK UI ← Server-Sent Events ← toUIMessageStreamResponse
```

### 2. Voice Flow
```
User Click → VoiceButton → MediaRecorder → Audio Blob → /api/transcribe → gpt-4o-transcribe
                                                                        ↓
Text Insertion ← Transcribed Text ← AI SDK experimental_transcribe
```

### 3. File Attachment Flow
```
User Click → AttachmentButton → File Dialog → AI Elements Context → Form Submission
                                                                  ↓
Backend Processing ← convertToModelMessages ← UIMessage with FileUIPart[]
```

## Message Structure

### UIMessage Format
```typescript
{
  id: string,
  role: 'user' | 'assistant' | 'system',
  parts: [
    { type: 'text', text: 'Hello world' },
    { type: 'reasoning', text: '...', state: 'streaming' | 'complete' },
    { type: 'file', url: '...', mediaType: '...', filename: '...' }
  ]
}
```

### Reasoning Integration
- **Backend**: Enabled via `providerOptions.openai.reasoningEffort: 'high'`
- **Frontend**: Automatically rendered in collapsible `Reasoning` components
- **Streaming**: Reasoning streams in real-time with visual indicators

## Development Patterns

### 1. First Principles Architecture
- **Single Responsibility**: Each component has one clear purpose
- **Composition**: Components compose together via props/callbacks
- **Separation of Concerns**: UI, state, and business logic separated
- **Type Safety**: Full TypeScript coverage with proper inference

### 2. AI SDK Integration Patterns
- **Provider Abstraction**: Use AI SDK providers, not direct API calls
- **Streaming First**: Always use streaming for better UX
- **Message Normalization**: Let AI SDK handle message format conversion
- **Error Handling**: Proper error boundaries and user feedback

### 3. Component Organization
```
app/chat/
├── page.tsx              # Main orchestrator
├── components/
│   ├── chat-composer.tsx # Input composition
│   ├── voice-button.tsx  # Voice recording
│   ├── attachment-button.tsx # File attachments
│   └── message-renderer.tsx  # Message display
└── PROJECT_OVERVIEW.md   # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- OpenAI API key (set in environment variables)
- Basic understanding of React/Next.js

### Key Commands
```bash
npm run dev    # Start development server
npm run build  # Build for production
npm run lint   # Run linting
```

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key_here
```

## What Makes This Special

1. **Modern AI Integration**: Uses 2025's latest models (gpt-5, gpt-4o-transcribe)
2. **Streaming Everything**: Real-time responses and reasoning
3. **Voice-First**: Seamless voice-to-text with latest transcription models
4. **Clean Architecture**: Modular, maintainable, testable code
5. **AI-Native UX**: Components designed specifically for AI interactions
6. **File Support**: Built-in attachment handling
7. **Reasoning Transparency**: Shows AI's thinking process

This project demonstrates how to build production-ready AI applications using the Vercel AI SDK ecosystem while maintaining clean, scalable code architecture.

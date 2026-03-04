# Prism Agent Integration

## What We Started With

A config-driven health quiz engine (12 variants) that generates one-shot AI assessments. After completing a quiz, users see their assessment with a booking CTA and PDF download. No way to continue the conversation.

Separately, a standalone Prism conversational health agent exists as its own project — a proven, multi-turn streaming chat that helps prospects understand their health through Prism's bioenergetic lens. It has evidence retrieval tools, 8 knowledge files, three-tier prompt caching, context management, rate limiting, voice input, thread persistence, and a polished chat UI.

## The Goal

Integrate the Prism agent into the quiz project so users can continue exploring their health after reading their assessment. The agent starts seeded with the user's quiz data (answers + assessment), so there's no cold start — it already knows their situation and can go deeper immediately.

The user flow: Quiz → Assessment → "Explore Your Results Further" → Agent conversation (streaming, evidence-based, multi-turn).

## What's Implemented So Far

### Backend (simplified reimplementations, not ported from standalone)

| File | Status | Notes |
|------|--------|-------|
| `app/api/agent/route.ts` | ✅ Built | Streaming endpoint with Sonnet 4.6, context management. Missing: cache manager, rate limiting, input validation |
| `app/api/agent/systemPrompt.ts` | ✅ Built | All 8 knowledge files, quiz context seeding (answers + assessment), stable/dynamic split. Adapted from standalone prompt structure |
| `app/api/agent/tools.ts` | ✅ Built | Search + read tools only. Missing: extract_findings depth tool |

### Persistence (simplified reimplementations)

| File | Status | Notes |
|------|--------|-------|
| `lib/agent/thread-store.ts` | ✅ Built | Dexie table keyed by quizId. Simplified from standalone |
| `hooks/use-agent-persistence.ts` | ✅ Built | Hydrate on mount, save on stream complete. Simplified from standalone |

### Frontend (simplified reimplementations — NOT ported from standalone)

| File | Status | Notes |
|------|--------|-------|
| `components/ai-elements/conversation.tsx` | ✅ Built | Auto-scroll via use-stick-to-bottom. Simplified |
| `components/ai-elements/message.tsx` | ✅ Built | User/assistant bubbles. Simplified |
| `components/ai-elements/tool-status.tsx` | ✅ Built | Animated indicator. Simplified |
| `components/ai-elements/sources.tsx` | ✅ Built | Collapsible citation drawer. Simplified |
| `components/ai-elements/reasoning.tsx` | ✅ Built | Collapsible thinking block. Simplified |
| `components/agent/agent-composer.tsx` | ✅ Built | Text input + send/stop. Simplified (no voice, no attachments) |

### Pages

| File | Status | Notes |
|------|--------|-------|
| `app/explore/[quizId]/page.tsx` | ✅ Built | Server component — validates quizId, passes props |
| `app/explore/[quizId]/agent-page.tsx` | ✅ Built | Client component — useChat with DefaultChatTransport, auto-trigger hidden first message, persistence |

### Quiz Integration (complete)

| File | Change | Status |
|------|--------|--------|
| `app/api/quiz/systemPrompt.ts` | Removed mandatory consultation closing | ✅ Done |
| `components/quiz/quiz-result.tsx` | Added "Explore Your Results Further" CTA | ✅ Done |

### Knowledge Files

All 8 present in `lib/knowledge/`:
- knowledge.md, questionaire.md, diet_lifestyle_standardized.md
- metabolism_deep_dive.md, gut_deep_dive.md
- evidence_hierarchy.md, takehome.md, prism_process.md

### Build Status

✅ Compiles clean. All routes present. Not yet tested end-to-end.

## What Needs To Happen Next

The current frontend components and some backend infrastructure are simplified rewrites, not the proven code from the standalone agent. We need to bring over the actual files and integrate them properly.

### Files to copy from the standalone Prism agent project

**Frontend components** (replace simplified versions):
```
components/ai-elements/conversation.tsx
components/ai-elements/message.tsx
components/ai-elements/tool-status.tsx
components/ai-elements/sources.tsx
components/ai-elements/reasoning.tsx
components/ai-elements/prompt-input.tsx
components/chat-view.tsx
```

**Hooks** (replace simplified versions):
```
hooks/use-persisted-chat.ts
hooks/use-thread-persistence.ts
```

**Lib utilities:**
```
lib/message-utils.ts
```

**Depth extraction tool** (new — not yet in project):
```
app/api/chat/tools/depthTool/depthTool.ts
app/api/chat/tools/depthTool/types.ts
app/api/chat/tools/depthTool/extraction/agent.ts
app/api/chat/tools/depthTool/extraction/prompt.ts
app/api/chat/tools/depthTool/extraction/schema.ts
```

**Infrastructure** (new — not yet in project):
```
app/api/chat/lib/cacheManager.ts
app/api/chat/lib/rateLimit.ts
app/api/chat/lib/inputValidation.ts
app/api/chat/lib/llmRetry.ts
app/api/chat/lib/retryConfig.ts
```

**Exa client** (for shared tool infrastructure):
```
app/api/chat/tools/researchTool/exaSearch/exaClient.ts
app/api/chat/tools/researchTool/exaSearch/rateLimiter.ts
app/api/chat/tools/researchTool/exaSearch/types.ts
```

### After files are copied

1. **Read and understand each file** in the context of this project
2. **Adapt paths and imports** — the standalone uses `app/api/chat/`, we use `app/api/agent/`
3. **Replace simplified components** with the proven versions, adapting for this project's context (no sidebar, no voice, single conversation per quiz)
4. **Wire the depth tool** into the agent route alongside search + read
5. **Integrate cache manager** into the agent route (stable/dynamic prompt split already exists)
6. **Integrate rate limiting + input validation** into the agent route
7. **Update agent-page.tsx** to use the proven chat UI components
8. **Build and test** end-to-end

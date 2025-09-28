# Chat Composer Layout Refactor Overview

This document captures the exact frontend changes applied to unify the chat composer experience. It compares the prior implementation with the current state and lists the rationale per file.

## Summary

- Introduced layout tokens so max-width and composer padding live in `app/globals.css`.
- Reworked `app/chat/thread-chat.tsx` to render a single composer, add consistent padding, and remove duplicate empty-state markup.
- Updated `app/chat/components/chat-composer.tsx` to anchor the composer (fixed on mobile, sticky on desktop), cap textarea height, and retain a single render path.

## app/globals.css

### Before
- No dedicated layout variables for chat container width or composer offset.

### After
- Added `--container-max-w` and `--composer-offset` to `:root` for reuse across the chat experience.

## app/chat/thread-chat.tsx

### Before
- Conversation wrapper used hard-coded `max-w-[840px]` strings.
- Empty state rendered an inline `ChatComposer` while existing threads rendered another instance at the bottom.
- Conversation content lacked extra padding, so the growing composer could overlap recent messages.
- Context warning banner width capped at `max-w-3xl` instead of matching the conversation container.

### After
- Conversation container consumes `max-w-[var(--container-max-w)]`.
- `ConversationContent` now applies `pb-[calc(var(--composer-offset)+env(safe-area-inset-bottom))]` when messages exist, preserving visibility behind the sticky composer.
- Empty state renders only the hero headline copy; the shared composer mounts once at the root with `variant="hero"`.
- Context warning banner reuses the container token for alignment.

## app/chat/components/chat-composer.tsx

### Before
- Hero variant was centered (`max-w-[52rem]`) and not anchored; mobile empty state used a floating pill.
- Textarea had no max-height cap and shared layout with desktop behavior.
- Submit button did not defer to anchoring needs and the component relied on duplicate instances.

### After
- Hero variant anchors to the viewport: fixed bottom on small screens (with safe-area padding) and sticky bottom on desktop while respecting `--container-max-w`.
- Added rounded surface states with top border + subtle shadow for desktop layering.
- Textarea defaults to `rows={1}` with `max-h-[40svh]`, keeping toolbar visible.
- Submit button now respects disabled state (e.g., context limit lock) via shared `disabled` prop.
- Composer renders once for all thread states, avoiding submission bugs from duplicate forms.

---


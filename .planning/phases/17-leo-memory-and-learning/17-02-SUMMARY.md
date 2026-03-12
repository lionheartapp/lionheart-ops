---
phase: 17-leo-memory-and-learning
plan: 02
subsystem: api
tags: [ai, conversations, gemini, prisma, sse, persistence, feedback]

# Dependency graph
requires:
  - phase: 17-leo-memory-and-learning-01
    provides: Conversation and ConversationMessage Prisma models, conversationService CRUD functions

provides:
  - Modified chat route that persists every Leo message (user, assistant, tool_call, tool_result) to DB
  - conversationId SSE event emitted at stream start for frontend tracking
  - Auto-title generation from first user message (first 100 chars)
  - GET /api/conversations — paginated list of user's conversations
  - GET /api/conversations/[id] — single conversation with org-scope guard
  - DELETE /api/conversations/[id] — owner-only soft-delete
  - GET /api/conversations/[id]/messages — paginated message history
  - POST /api/conversations/[id]/feedback — thumbs up/down (score 1-5) per message

affects:
  - 17-leo-memory-and-learning-03
  - frontend AI assistant components (ChatPanel, conversation history UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - safeAsync fire-and-forget wrapper for persistence in SSE streaming hot path
    - conversationId resolved before stream creation, captured in closure
    - owner-only vs org-only scoping: DELETE uses userId check, GET uses orgId only

key-files:
  created:
    - src/app/api/conversations/route.ts
    - src/app/api/conversations/[id]/route.ts
    - src/app/api/conversations/[id]/messages/route.ts
    - src/app/api/conversations/[id]/feedback/route.ts
  modified:
    - src/app/api/ai/assistant/chat/route.ts

key-decisions:
  - "Fire-and-forget persistence via safeAsync wrapper — errors logged but never break SSE streaming"
  - "conversationId resolved synchronously before stream creation; conversation_id SSE event emitted as first event in stream"
  - "DELETE /api/conversations/[id] checks userId (owner-only), not just orgId — users can only delete their own conversations"
  - "Auto-title uses first 100 chars of user message — simple, no AI call needed"
  - "Tool call and tool result messages persisted with toolName and toolSuccess for analytics"

patterns-established:
  - "safeAsync(fn, label): fire-and-forget wrapper that logs errors but never throws — use for non-critical side effects in hot paths"
  - "Resolve/create conversation before starting SSE stream; capture ID in closure for stream use"

requirements-completed:
  - LEO-MEM-01
  - LEO-MEM-02

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 17 Plan 02: Leo Memory and Learning — Conversation Persistence and CRUD API Summary

**Leo chat route now persists every message to DB via fire-and-forget safeAsync calls; 4 new API routes expose conversation history, deletion, and per-message thumbs up/down feedback**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-12T03:46:26Z
- **Completed:** 2026-03-12T03:54:00Z
- **Tasks:** 2
- **Files modified:** 5 (1 modified, 4 created)

## Accomplishments

- Modified chat route: every user message, assistant response, tool_call, and tool_result is persisted to `ConversationMessage` as a non-blocking side effect using `safeAsync`
- conversationId resolved (or new conversation created) before the SSE stream opens; `{ type: 'conversation_id', conversationId }` is the first SSE event emitted
- Auto-title: new conversations are named from the first 100 chars of the user's message without an AI call
- 4 new CRUD routes: list conversations (paginated), get single, delete (owner-only), get messages (paginated), and submit feedback (score 1-5 per message)

## Task Commits

Each task was committed atomically:

1. **Task 1: Modify chat route to persist conversations and messages** - `1efb61a` (feat)
2. **Task 2: Create conversation CRUD and feedback API routes** - `0773348` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `src/app/api/ai/assistant/chat/route.ts` - Added conversationId resolution, safeAsync persistence for all message types, conversation_id SSE event, auto-title
- `src/app/api/conversations/route.ts` - GET: paginated conversation list (limit/offset, max 50)
- `src/app/api/conversations/[id]/route.ts` - GET: single conversation with org-scope; DELETE: owner-only soft-delete
- `src/app/api/conversations/[id]/messages/route.ts` - GET: paginated messages for a conversation (limit/offset, max 500)
- `src/app/api/conversations/[id]/feedback/route.ts` - POST: messageId + score (1-5), verifies message belongs to org

## Decisions Made

- **Fire-and-forget persistence**: All `addMessage` and `updateConversationTitle` calls are wrapped in `safeAsync` — errors are logged to console but never interrupt the SSE stream. This is the correct tradeoff: persistence failure should not degrade the user's chat experience.
- **conversationId before stream**: The conversation is resolved/created synchronously before `new ReadableStream(...)` so the ID is available in the closure. The `conversation_id` SSE event is the very first thing emitted so the frontend gets the ID immediately.
- **Owner-only DELETE**: `DELETE /api/conversations/[id]` uses `userId: ctx.userId` in the `rawPrisma.findFirst` query, not just `organizationId`. This prevents one org member from deleting another's conversation history.
- **Auto-title simplicity**: Title is set to first 100 chars of user message — no Gemini call needed. Fast, deterministic, sufficient for a "History" sidebar UX.

## Deviations from Plan

None — plan executed exactly as written. All persistence is fire-and-forget as specified. All 4 routes follow project conventions (getOrgIdFromRequest, getUserContext, runWithOrgContext, ok/fail, Pino, Sentry).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Conversation schema was already migrated in Plan 17-01.

## Next Phase Readiness

- Plan 17-03 can import conversationId from the chat SSE stream to link embeddings/recall to specific conversations
- Frontend ChatPanel can read the `conversation_id` SSE event and display a "History" panel using `GET /api/conversations`
- Feedback UI (thumbs up/down buttons on messages) can call `POST /api/conversations/[id]/feedback` with the messageId received in the `done` event's conversationHistory

---
*Phase: 17-leo-memory-and-learning*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: src/app/api/conversations/route.ts
- FOUND: src/app/api/conversations/[id]/route.ts
- FOUND: src/app/api/conversations/[id]/messages/route.ts
- FOUND: src/app/api/conversations/[id]/feedback/route.ts
- FOUND: .planning/phases/17-leo-memory-and-learning/17-02-SUMMARY.md
- FOUND commit: 1efb61a (feat(17-02): persist conversations and messages in Leo chat route)
- FOUND commit: 0773348 (feat(17-02): add conversation CRUD and feedback API routes)

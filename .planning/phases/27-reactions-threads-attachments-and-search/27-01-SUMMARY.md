---
phase: 27-reactions-threads-attachments-and-search
plan: 01
subsystem: messaging
tags: [reactions, emoji, pin, mute, tanstack-query, prisma]

requires:
  - phase: 23-messaging-foundation
    provides: MessageReaction model, ChannelMember.mutedAt, Message.pinnedAt fields
  - phase: 24-messaging-api
    provides: withAuth wrapper, messaging-gate, messageService patterns
  - phase: 26-messaging-ui
    provides: MessageBubble, EmojiPicker, MessageArea, ChannelListItem components

provides:
  - Reaction toggle API (POST /messages/[id]/reactions)
  - Batch reaction fetch API (GET /reactions?messageId=...)
  - Pinned messages API (GET /channels/[id]/pins)
  - Pin/unpin via PATCH /messages/[id] with pinnedAt field
  - Channel mute toggle API (POST /channels/[id]/mute)
  - ReactionBar and ReactionPicker UI components
  - PinnedMessagesPanel slide-in component
  - ChannelHeader with pin count and mute toggle
  - useReactions and usePinnedMessages TanStack Query hooks

affects: [27-02-attachments, 27-03-search, 28-notifications]

tech-stack:
  added: []
  patterns: [batch reaction loading, optimistic reaction toggle, compound hover action bar]

key-files:
  created:
    - src/lib/services/reactionService.ts
    - src/app/api/messaging/messages/[id]/reactions/route.ts
    - src/app/api/messaging/channels/[id]/pins/route.ts
    - src/app/api/messaging/channels/[id]/mute/route.ts
    - src/app/api/messaging/reactions/route.ts
    - src/components/messaging/ReactionBar.tsx
    - src/components/messaging/ReactionPicker.tsx
    - src/components/messaging/PinnedMessagesPanel.tsx
    - src/components/messaging/ChannelHeader.tsx
    - src/lib/hooks/useReactions.ts
    - src/lib/hooks/usePinnedMessages.ts
  modified:
    - src/app/api/messaging/messages/[id]/route.ts
    - src/components/messaging/MessageBubble.tsx
    - src/components/messaging/MessageArea.tsx
    - src/components/messaging/MessageList.tsx
    - src/components/messaging/ChannelListItem.tsx

key-decisions:
  - "Combined edit and pin/unpin into single PATCH endpoint with discriminated schema"
  - "Compact 16-emoji ReactionPicker for speed, with full EmojiPicker fallback"
  - "Batch reaction fetch endpoint to avoid N+1 queries on message lists"

patterns-established:
  - "Batch reaction loading: GET /reactions?messageId=X&messageId=Y for visible messages"
  - "Compound hover action bar: pin + thread buttons appear on message hover"

requirements-completed: [MSG-04, MSG-06]

duration: 7min
completed: 2026-05-07
---

# Phase 27 Plan 01: Reactions, Pins, and Mute Summary

**Emoji reactions with toggle/count pills, message pinning with panel, and channel mute toggle across API and UI layers**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-07T21:21:33Z
- **Completed:** 2026-05-07T21:28:36Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Reaction service with toggle and batch-load, plus API routes for toggling and batch fetching
- Pin/unpin via extended PATCH endpoint with MESSAGING_CHANNELS_MODERATE permission check
- Pinned messages panel with GET endpoint and slide-in UI
- Channel mute toggle with dimmed channel list items
- ChannelHeader component with pin count, mute button, and member count

## Task Commits

1. **Task 1: Reaction service, pin/mute routes, and reaction API route** - `47d7628` (feat)
2. **Task 2: Reaction UI, pin UI, and mute UI** - `178de78` (feat)

## Files Created/Modified
- `src/lib/services/reactionService.ts` - toggleReaction + getReactionsForMessages
- `src/app/api/messaging/messages/[id]/reactions/route.ts` - POST toggle reaction
- `src/app/api/messaging/reactions/route.ts` - GET batch reactions
- `src/app/api/messaging/channels/[id]/pins/route.ts` - GET pinned messages
- `src/app/api/messaging/channels/[id]/mute/route.ts` - POST mute toggle
- `src/app/api/messaging/messages/[id]/route.ts` - Extended PATCH for pin/unpin
- `src/components/messaging/ReactionBar.tsx` - Reaction pills display
- `src/components/messaging/ReactionPicker.tsx` - Compact emoji grid picker
- `src/components/messaging/PinnedMessagesPanel.tsx` - Slide-in pinned messages list
- `src/components/messaging/ChannelHeader.tsx` - Channel info bar with actions
- `src/components/messaging/MessageBubble.tsx` - Extended with reactions, pin, action bar
- `src/components/messaging/MessageArea.tsx` - Wired reactions, pin, mute
- `src/components/messaging/MessageList.tsx` - Passes reaction/pin props through
- `src/components/messaging/ChannelListItem.tsx` - Muted state with opacity + bell icon
- `src/lib/hooks/useReactions.ts` - TanStack Query hooks for reactions
- `src/lib/hooks/usePinnedMessages.ts` - TanStack Query hook for pinned messages

## Decisions Made
- Combined edit and pin into one PATCH endpoint with Zod union schema (pinnedAt: "now" | null) to avoid a separate route
- Created a batch reactions endpoint (GET /reactions?messageId=...) to avoid N+1 queries from the message list
- Used a compact 16-emoji picker for reactions instead of the full emoji-mart picker for speed, with a "more" button fallback

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added batch reactions endpoint**
- **Found during:** Task 2 (useReactions hook)
- **Issue:** useReactions needed to fetch reactions for multiple messages at once, but no batch endpoint existed
- **Fix:** Created GET /api/messaging/reactions?messageId=... endpoint that delegates to getReactionsForMessages
- **Files modified:** src/app/api/messaging/reactions/route.ts
- **Committed in:** 178de78 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Batch endpoint was necessary for the useReactions hook to function. No scope creep.

## Issues Encountered
- TypeScript check runs out of memory with default heap size on this large codebase. Used NODE_OPTIONS="--max-old-space-size=8192" to work around it. All pre-existing type errors remain; no new errors from this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reaction, pin, and mute features are complete and ready for use
- Phase 27 Plan 02 (attachments) can proceed independently
- Phase 27 Plan 03 (search UI) can proceed independently

---
*Phase: 27-reactions-threads-attachments-and-search*
*Completed: 2026-05-07*

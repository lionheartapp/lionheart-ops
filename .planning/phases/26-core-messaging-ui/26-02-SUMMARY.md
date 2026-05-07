---
phase: 26-core-messaging-ui
plan: 02
subsystem: ui
tags: [react-virtuoso, tanstack-query, realtime, messaging, virtual-scroll]

requires:
  - phase: 26-01
    provides: MessagingShell, ChannelList, useChannels, messaging page layout
  - phase: 24-core-messaging-api
    provides: Message CRUD API, messageService, cursor-based pagination
  - phase: 25-realtime-bridge-and-jwt-integration
    provides: RealtimeProvider, useRealtimeChannel hook

provides:
  - MessageList with react-virtuoso virtual scrolling and prepend pagination
  - MessageBubble with avatar, timestamp, edited indicator, reply count
  - MessageArea orchestrating API + realtime message streams
  - useMessages infinite query hook with cursor-based pagination
  - useMarkChannelRead mutation for unread count reset

affects: [26-03, 26-04, 27-rich-messaging]

tech-stack:
  added: [react-virtuoso]
  patterns: [virtuoso-prepend-pattern, broadcast-to-api-dedup, typing-indicator]

key-files:
  created:
    - src/lib/hooks/useMessages.ts
    - src/components/messaging/MessageBubble.tsx
    - src/components/messaging/MessageList.tsx
    - src/components/messaging/MessageArea.tsx
  modified:
    - src/components/messaging/MessagingShell.tsx
    - package.json

key-decisions:
  - "Used firstItemIndex prepend pattern for stable scroll during history load"
  - "Realtime messages deduplicated against API data by ID"
  - "Own messages tinted bg-primary-50 (not right-aligned, Slack-style)"

patterns-established:
  - "Virtuoso prepend pattern: START_INDEX=100000, firstItemIndex=START_INDEX-messages.length"
  - "Broadcast-to-API dedup: realtime msgs held in local state, filtered out when API refetch returns same IDs"
  - "Message collapsing: same author within 5 min hides avatar/name"

requirements-completed: [UI-02]

duration: 5min
completed: 2026-05-07
---

# Phase 26 Plan 02: Message List and Realtime Display Summary

**Virtual-scrolled message list with react-virtuoso, cursor pagination, and realtime broadcast integration**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-07T20:54:46Z
- **Completed:** 2026-05-07T20:59:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Virtual-scrolled message list handles 500+ messages without scroll performance degradation
- Cursor-based pagination loads older messages on scroll-up with stable scroll position
- Realtime messages from other users appear at the bottom without refresh
- Typing indicators show below the message list with pulse animation
- Skeleton loading during initial fetch matches message bubble layout shape

## Task Commits

Each task was committed atomically:

1. **Task 1: useMessages hook and MessageBubble component** - `7f1dc36` (feat)
2. **Task 2: MessageList with virtual scroll and MessageArea with realtime** - `77c0d62` (feat)

## Files Created/Modified
- `src/lib/hooks/useMessages.ts` - TanStack Query infinite query + mark-read mutation
- `src/components/messaging/MessageBubble.tsx` - Individual message rendering with avatar, timestamps, edited/reply indicators
- `src/components/messaging/MessageList.tsx` - react-virtuoso virtual scroll with prepend pattern
- `src/components/messaging/MessageArea.tsx` - Orchestrates API pagination + realtime dedup + typing indicator
- `src/components/messaging/MessagingShell.tsx` - Updated to render MessageArea when channel selected
- `package.json` - Added react-virtuoso dependency

## Decisions Made
- Used Virtuoso's firstItemIndex prepend pattern (START_INDEX=100000) for stable scroll position during history loading
- Realtime messages stored in local state and deduplicated against API data by message ID
- Own messages use bg-primary-50 tint (not right-aligned) per Slack-style convention for group chat clarity
- Consecutive messages from same author within 5 minutes collapse avatar and name

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript compiler OOM with default heap size; resolved by using --max-old-space-size=8192
- Pre-existing TS error in RealtimeProvider.tsx (string | undefined for supabaseUrl) is not from this plan's changes

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Message composer (Plan 03) can now be placed below the MessageList in MessageArea
- Thread panel (Plan 04) can wire into the onThreadClick callback already plumbed through

---
*Phase: 26-core-messaging-ui*
*Completed: 2026-05-07*

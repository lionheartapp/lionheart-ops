---
phase: 25-realtime-bridge-and-jwt-integration
plan: 02
subsystem: realtime
tags: [supabase-realtime, react-context, websocket, presence, typing-indicators, broadcast]

requires:
  - phase: 25-01
    provides: "GET /api/auth/token endpoint returning JWT for Supabase Realtime accessToken"
provides:
  - "RealtimeProvider React context with JWT-authenticated Supabase client"
  - "useRealtime() consumer hook for accessing the Realtime client"
  - "useRealtimeChannel() hook for broadcast messages, typing indicators, and presence"
affects: [26-messaging-ui, messaging-compose, messaging-channel-view]

tech-stack:
  added: []
  patterns: [realtime-provider-context, broadcast-subscription-hook, presence-heartbeat, typing-debounce]

key-files:
  created:
    - src/components/messaging/RealtimeProvider.tsx
    - src/lib/hooks/useRealtimeChannel.ts
  modified: []

key-decisions:
  - "Token refresh via setTimeout 5 min before expiry with exponential backoff (not polling interval)"
  - "Dynamic import of @supabase/supabase-js to avoid bundling in non-messaging pages"
  - "User activity detection via keydown/mousemove/click listeners for away status"
  - "Presence heartbeat every 60s re-tracks status based on lastActivity vs 5-min threshold"

patterns-established:
  - "RealtimeProvider pattern: dedicated Supabase client with accessToken callback, separate from anon-key client"
  - "Channel hook pattern: useRealtimeChannel subscribes to broadcast + presence on a single topic, cleans up on channelId change"
  - "Typing debounce: 3s sender-side guard via useRef timestamp, 3s receiver-side clear timeout per userId"

requirements-completed: [RT-01, RT-02, RT-03]

duration: 2min
completed: 2026-05-07
---

# Phase 25 Plan 02: Client-Side Realtime Infrastructure Summary

**RealtimeProvider context with JWT-authenticated Supabase client and useRealtimeChannel hook for broadcast messages, typing indicators, and presence**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-07T20:31:10Z
- **Completed:** 2026-05-07T20:32:57Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- RealtimeProvider creates a dedicated Supabase client authenticated via /api/auth/token JWT, with token refresh before expiry and exponential backoff on failures
- useRealtimeChannel hook subscribes to broadcast messages (new_message), typing indicators (3s debounce/clear), and presence (online/away/offline with 5-min threshold)
- Full cleanup on unmount: channels unsubscribed, timeouts cleared, intervals stopped, activity listeners removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create RealtimeProvider context** - `def6031` (feat)
2. **Task 2: Create useRealtimeChannel hook** - `0112732` (feat)

## Files Created/Modified
- `src/components/messaging/RealtimeProvider.tsx` - React context provider with JWT-authenticated Supabase client, token refresh, and graceful degradation
- `src/lib/hooks/useRealtimeChannel.ts` - Hook for channel broadcast subscription, typing indicators, and presence with full cleanup

## Decisions Made
- Token refresh uses setTimeout calculated from expiresAt (5 min before expiry), not a polling interval. On failure, exponential backoff 1s/2s/4s up to 30s, gives up after 3 consecutive failures.
- Dynamic import of @supabase/supabase-js keeps the Realtime bundle out of pages that don't use messaging.
- User activity tracked via keydown/mousemove/click window listeners. Heartbeat re-tracks presence every 60s, switching to "away" if no activity in 5 minutes.
- incomingMessage exposes only the latest broadcast message (not an array). Consuming components are responsible for deduplication and list management.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 26 (messaging UI) can import useRealtimeChannel and get real-time message delivery, typing indicators, and presence without building any Realtime plumbing
- RealtimeProvider must wrap the messaging layout for the hook to work
- The hook returns incomingMessage (single latest message) — consumers append to their own list and handle deduplication

## Self-Check: PASSED

---
*Phase: 25-realtime-bridge-and-jwt-integration*
*Completed: 2026-05-07*

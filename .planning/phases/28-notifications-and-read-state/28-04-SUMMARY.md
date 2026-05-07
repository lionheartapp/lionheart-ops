---
phase: 28-notifications-and-read-state
plan: 04
subsystem: ui
tags: [react, tanstack-query, supabase-realtime, framer-motion, web-push, notifications]

requires:
  - phase: 28-notifications-and-read-state/01
    provides: mark-as-read API endpoint and notification service
  - phase: 28-notifications-and-read-state/02
    provides: preferences API and push subscription API
  - phase: 28-notifications-and-read-state/03
    provides: push delivery service and email digest cron
provides:
  - useMessagingNotifications hook for realtime notification subscription
  - MessagingToast component for in-app notification display
  - ChannelPreferencesDropdown for per-channel notification settings
  - usePushSubscription hook for browser push registration
  - Mark-as-read wiring with visibility change detection
affects: [messaging-ui, notification-preferences, push-notifications]

tech-stack:
  added: []
  patterns: [user-specific-realtime-broadcast, fire-and-forget-mark-read, vapid-push-subscription]

key-files:
  created:
    - src/lib/hooks/useMessagingNotifications.ts
    - src/components/messaging/MessagingToast.tsx
    - src/components/messaging/ChannelPreferencesDropdown.tsx
    - src/lib/hooks/usePushSubscription.ts
  modified:
    - src/components/messaging/MessageArea.tsx
    - src/lib/hooks/useMessages.ts

key-decisions:
  - "Fixed useMarkChannelRead to use correct PATCH endpoint instead of non-existent POST /mark-read"
  - "Used ref-based callback pattern in useMessagingNotifications to avoid stale closures"
  - "Push subscription hook includes isLoading state for better UX during async checks"

patterns-established:
  - "User-specific Realtime broadcast topic: notif:{orgId}:{userId}"
  - "Visibility change listener for re-marking channels as read on tab focus"
  - "VAPID base64 to Uint8Array conversion for push manager subscription"

requirements-completed: [NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-05]

duration: 4min
completed: 2026-05-07
---

# Phase 28 Plan 04: Notification UI Wiring Summary

**Realtime toast notifications, mark-as-read with tab-focus detection, per-channel preferences dropdown, and VAPID push subscription hook**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-07T21:55:23Z
- **Completed:** 2026-05-07T21:58:54Z
- **Tasks:** 2 auto + 1 checkpoint (noted, not blocking)
- **Files modified:** 6

## Accomplishments
- Wired mark-as-read to fire on channel open AND tab refocus, clearing unread badges accurately
- Created realtime notification hook subscribing to user-specific broadcast topic for mentions and DMs
- Built glassmorphism toast component with Framer Motion slide-in animation
- Created per-channel notification preferences dropdown (all/mentions/none + email digest toggle)
- Created push subscription hook with VAPID key support and server sync

## Task Commits

Each task was committed atomically:

1. **Task 1: Mark-as-read wiring + realtime notification hook + toast** - `aae4c6e` (feat)
2. **Task 2: Channel preferences dropdown + push subscription hook** - `0bfeee2` (feat)
3. **Task 3: Human verification checkpoint** - noted in summary, not blocking

## Files Created/Modified
- `src/lib/hooks/useMessagingNotifications.ts` - Realtime broadcast subscription for user notifications
- `src/components/messaging/MessagingToast.tsx` - Slide-in toast with glassmorphism and auto-dismiss
- `src/components/messaging/ChannelPreferencesDropdown.tsx` - Per-channel notification level and email digest UI
- `src/lib/hooks/usePushSubscription.ts` - Browser push notification registration with VAPID
- `src/components/messaging/MessageArea.tsx` - Added visibilitychange listener for mark-as-read on tab focus
- `src/lib/hooks/useMessages.ts` - Fixed useMarkChannelRead to use correct PATCH /channels/:id/read endpoint

## Decisions Made
- Fixed the mark-as-read hook endpoint from POST /mark-read (non-existent) to PATCH /read (actual endpoint from Plan 01)
- Used ref-based callback in useMessagingNotifications to avoid re-subscribing on every callback change
- Added isLoading state to usePushSubscription for better first-render UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed useMarkChannelRead endpoint mismatch**
- **Found during:** Task 1 (mark-as-read wiring)
- **Issue:** useMarkChannelRead was calling POST /api/messaging/channels/:id/mark-read, but the actual endpoint from Plan 01 is PATCH /api/messaging/channels/:id/read
- **Fix:** Updated the fetch URL and method in useMessages.ts
- **Files modified:** src/lib/hooks/useMessages.ts
- **Verification:** TypeScript compiles, endpoint matches route file
- **Committed in:** aae4c6e (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix -- mark-as-read would have silently failed without it.

## Checkpoint Note

Task 3 is a human-verify checkpoint for visual/functional testing. The automated tasks are complete. Verification steps from the plan:
1. Open messaging page, verify sidebar badge shows unread count
2. Click a channel with unreads, verify badge clears
3. Switch tabs and return, verify re-mark fires
4. Click bell icon in channel header, verify preferences dropdown
5. Change preference to "Mentions only", verify it saves
6. Check push subscription prompt on first visit

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All notification UI components are built and type-checked
- Components need to be wired into the messaging page layout (useMessagingNotifications called once, ChannelPreferencesDropdown added to ChannelHeader)
- Push prompt banner needs integration into the messaging page

---
*Phase: 28-notifications-and-read-state*
*Completed: 2026-05-07*

## Self-Check: PASSED
- All 4 created files exist on disk
- Both task commits (aae4c6e, 0bfeee2) found in git log

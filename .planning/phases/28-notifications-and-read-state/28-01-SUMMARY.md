---
phase: 28-notifications-and-read-state
plan: 01
subsystem: api
tags: [notifications, messaging, mentions, dms, prisma]

requires:
  - phase: 23-messaging-schema
    provides: ChannelMember with unreadCount, lastReadAt, reset_unread_on_read trigger, MessagingNotificationPreference model
  - phase: 24-messaging-core
    provides: messageService.ts with sendMessage and parseMentions, MessageMention rows
provides:
  - PATCH /api/messaging/channels/[id]/read mark-as-read endpoint
  - messagingNotificationService with notifyMentionedUsers and notifyDMRecipients
  - messaging_mention and messaging_dm notification types
affects: [28-02, 28-03, 28-04, notifications-ui, messaging-ui]

tech-stack:
  added: []
  patterns: [fire-and-forget notification dispatch via .catch swallow, per-channel preference check before notification creation]

key-files:
  created:
    - src/app/api/messaging/channels/[id]/read/route.ts
    - src/lib/services/messagingNotificationService.ts
  modified:
    - src/lib/services/messageService.ts
    - src/lib/services/notificationService.ts

key-decisions:
  - "Used fire-and-forget pattern for notification dispatch to avoid blocking message sending"
  - "Notification preference check uses rawPrisma since MessagingNotificationPreference is not org-scoped in extension"
  - "Extracted fireMessageNotifications helper to avoid duplicating channel-type check in both sendMessage paths"

patterns-established:
  - "Fire-and-forget messaging notifications: async IIFE with .catch(() => {}) after parseMentions"
  - "Per-channel notification preference gate: query level=none from MessagingNotificationPreference before creating notifications"

requirements-completed: [NOTIF-01, NOTIF-02]

duration: 3min
completed: 2026-05-07
---

# Phase 28 Plan 01: Mark-as-Read and Messaging Notifications Summary

**Mark-as-read API endpoint and fire-and-forget notification service for @mentions and DMs, wired into sendMessage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-07T21:44:30Z
- **Completed:** 2026-05-07T21:48:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- PATCH endpoint that updates lastReadAt on ChannelMember (Postgres trigger resets unreadCount)
- Notification service that creates Notification rows for @mentioned users and DM recipients
- Wired into sendMessage so notifications fire automatically after every message

## Task Commits

Each task was committed atomically:

1. **Task 1: Mark-as-read API endpoint** - `410b371` (feat)
2. **Task 2: Messaging notification service + wire into sendMessage** - `93736a9` (feat)

## Files Created/Modified
- `src/app/api/messaging/channels/[id]/read/route.ts` - Mark-as-read PATCH endpoint using withAuth wrapper
- `src/lib/services/messagingNotificationService.ts` - notifyMentionedUsers and notifyDMRecipients functions
- `src/lib/services/messageService.ts` - Added fireMessageNotifications helper, wired into sendMessage
- `src/lib/services/notificationService.ts` - Added messaging_mention and messaging_dm types

## Decisions Made
- Used fire-and-forget pattern (async IIFE + .catch) so notification failures never break message sending
- Extracted a `fireMessageNotifications` helper to DRY the two sendMessage return paths (with-attachments and without)
- Used rawPrisma for preference queries since MessagingNotificationPreference is not in the org-scoped extension whitelist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected MessageMention field name**
- **Found during:** Task 2
- **Issue:** Plan interface listed `userId` on MessageMention but actual schema uses `mentionedUserId`
- **Fix:** Used correct field name `mentionedUserId` in queries
- **Files modified:** src/lib/services/messagingNotificationService.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 93736a9

**2. [Rule 2 - Missing Critical] Extracted fireMessageNotifications helper**
- **Found during:** Task 2
- **Issue:** sendMessage has two return paths (with attachments and without) that both need notification dispatch
- **Fix:** Created a shared helper function to avoid duplicating the channel-type lookup and notification logic
- **Files modified:** src/lib/services/messageService.ts
- **Verification:** tsc --noEmit passes, both paths call the helper
- **Committed in:** 93736a9

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Mark-as-read endpoint ready for UI integration (ChannelListItem can call PATCH on channel open)
- Notification rows will be created for mentions and DMs, ready for realtime toast delivery (Plan 04)
- Per-channel preference checks in place, ready for preferences UI (Plan 05)

---
*Phase: 28-notifications-and-read-state*
*Completed: 2026-05-07*

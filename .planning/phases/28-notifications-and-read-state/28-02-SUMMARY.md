---
phase: 28-notifications-and-read-state
plan: 02
subsystem: api
tags: [messaging, notifications, push, preferences, zod, prisma]

requires:
  - phase: 23-messaging-data-model
    provides: MessagingNotificationPreference and PushSubscription Prisma models

provides:
  - Per-channel notification preferences GET/PUT API
  - Push subscription POST/DELETE API
  - messagingPreferenceService with shouldNotify, getChannelPreference, getUserDigestPreference

affects: [28-03-push-delivery, 28-04-notification-ui, 28-05-email-digest]

tech-stack:
  added: []
  patterns: [withAuth wrapper for messaging routes, rawPrisma for cross-context service queries]

key-files:
  created:
    - src/lib/services/messagingPreferenceService.ts
    - src/app/api/messaging/channels/[id]/preferences/route.ts
    - src/app/api/messaging/push-subscription/route.ts
  modified: []

key-decisions:
  - "Used rawPrisma in messagingPreferenceService since it runs from cron and notification contexts outside runWithOrgContext"
  - "Upsert pattern on compound unique keys for idempotent preference and subscription updates"

patterns-established:
  - "Messaging preference service: rawPrisma for shared query logic callable from any context"
  - "HTTPS enforcement on push subscription endpoints via explicit URL check"

requirements-completed: [NOTIF-05, NOTIF-03]

duration: 3min
completed: 2026-05-07
---

# Phase 28 Plan 02: Notification Preferences and Push Subscription APIs

**Per-channel notification level preferences (all/mentions/none) and Web Push subscription registration with HTTPS enforcement**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-07T21:44:50Z
- **Completed:** 2026-05-07T21:47:48Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- Preference service with shouldNotify logic for use by notification delivery and cron
- GET/PUT API for per-channel notification preferences with Zod validation
- POST/DELETE API for push subscription management with HTTPS endpoint enforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: Messaging preference service + preferences API route** - `5d96fbf` (feat)
2. **Task 2: Push subscription registration API** - `9213b0d` (feat)

## Files Created/Modified
- `src/lib/services/messagingPreferenceService.ts` - Shared preference queries (getChannelPreference, shouldNotify, getUserDigestPreference)
- `src/app/api/messaging/channels/[id]/preferences/route.ts` - GET/PUT per-channel notification preferences
- `src/app/api/messaging/push-subscription/route.ts` - POST/DELETE push subscription endpoints

## Decisions Made
- Used rawPrisma in the preference service because it needs to work from cron jobs and notification pipelines that run outside runWithOrgContext
- Default preference when no row exists: level "all", emailDigest true (matches schema defaults)
- getUserDigestPreference treats "no rows at all" as digest enabled (user hasn't opted out)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Preference service ready for Plan 03 (push delivery) to call shouldNotify before sending
- Push subscription table ready for Plan 03 to query when delivering web push
- Preference API ready for Plan 04 (notification UI) to render preference controls

---
*Phase: 28-notifications-and-read-state*
*Completed: 2026-05-07*

---
phase: 28-notifications-and-read-state
plan: 03
subsystem: api
tags: [web-push, vapid, service-worker, cron, email-digest, notifications]

requires:
  - phase: 28-notifications-and-read-state/01
    provides: "MessagingNotificationPreference + PushSubscription schema, messagingNotificationService"
  - phase: 28-notifications-and-read-state/02
    provides: "Mark-as-read API, unread badge UI, notification preferences"
provides:
  - "Server-side web push notification delivery via web-push library"
  - "Service worker push + notificationclick handlers with deep-linking"
  - "Email digest cron endpoint for batched unread summaries"
  - "Messaging digest email template with channel-grouped previews"
affects: [28-notifications-and-read-state/04, messaging-ui, push-subscription-registration]

tech-stack:
  added: [web-push, "@types/web-push"]
  patterns: [vapid-push-delivery, cron-auth-bearer-pattern, best-effort-push]

key-files:
  created:
    - src/lib/services/pushNotificationService.ts
    - src/app/api/cron/messaging-digest/route.ts
    - src/lib/services/email/messaging-emails.ts
  modified:
    - src/app/sw.ts
    - src/lib/services/email/index.ts
    - package.json

key-decisions:
  - "Push payloads contain only generic title + channel name, never message content (T-28-08 mitigation)"
  - "Expired push subscriptions auto-cleaned on 404/410 to prevent unbounded retries (T-28-10)"
  - "Digest cron uses simple emailDigest boolean toggle per channel — granular frequency deferred"

patterns-established:
  - "Best-effort push: sendPushNotification never throws, returns boolean"
  - "Digest email respects per-channel + global emailDigest preferences"

requirements-completed: [NOTIF-03, NOTIF-04]

duration: 4min
completed: 2026-05-07
---

# Phase 28 Plan 03: Push Notifications and Email Digest Summary

**VAPID-based web push delivery service with expired subscription cleanup, service worker notification handlers, and daily email digest cron for unread message summaries**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-07T08:09:47Z
- **Completed:** 2026-05-07T08:13:42Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Push notification service that sends VAPID notifications to all user subscriptions, auto-removing expired ones
- Service worker extended with push event handler (shows notification) and notificationclick (deep-links to channel)
- Cron endpoint at /api/cron/messaging-digest that queries all messaging-enabled orgs and sends per-user digest emails
- Mobile-friendly HTML digest email template with channel-grouped unread previews (80-char truncation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Push notification service + service worker push handler** - `3469f9d` (feat)
2. **Task 2: Email digest cron endpoint + email template** - `01e0984` (feat)

## Files Created/Modified
- `src/lib/services/pushNotificationService.ts` - Server-side push via web-push with VAPID config and subscription cleanup
- `src/app/sw.ts` - Added push and notificationclick event listeners before Serwist
- `src/app/api/cron/messaging-digest/route.ts` - CRON_SECRET-secured digest cron, queries unreads, sends emails
- `src/lib/services/email/messaging-emails.ts` - HTML digest email template with channel grouping
- `src/lib/services/email/index.ts` - Added sendMessagingDigest to barrel export
- `package.json` - Added web-push + @types/web-push

## Decisions Made
- Push payloads are intentionally generic (title + channel name only) — actual message content requires authenticated app open (T-28-08)
- Expired subscriptions cleaned on 404/410 status codes to prevent retry storms (T-28-10)
- Digest frequency is controlled by emailDigest boolean toggle per channel, not a granular schedule selector — the cron runs on a fixed schedule and users opt in/out

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

VAPID keys needed for web push to work:
- `VAPID_PUBLIC_KEY` - Generate with `npx web-push generate-vapid-keys`
- `VAPID_PRIVATE_KEY` - Generate with `npx web-push generate-vapid-keys`
- `VAPID_SUBJECT` - Set to `mailto:contact@lionheartapp.com` (optional, defaults to no-reply)

Push notifications silently skip if VAPID keys are not configured.

## Next Phase Readiness
- Push subscription registration UI (prompt user to enable push) can be built in Plan 04
- Digest cron needs a vercel.json schedule entry for production deployment
- Integration with messagingNotificationService to call sendPushToUser after creating notification rows

---
*Phase: 28-notifications-and-read-state*
*Completed: 2026-05-07*

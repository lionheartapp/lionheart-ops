---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 10
subsystem: api
tags: [twilio, google-calendar, sms, notifications, smoke-tests, integrations, middleware]

# Dependency graph
requires:
  - phase: 22-ai-budget-notifications-and-external-integrations
    provides: "notificationOrchestrationService, eventProjectService, twilioService, googleCalendarService from plans 04-09"
provides:
  - "SMS delivery channel wired into notification cron dispatch (via Twilio)"
  - "Google Calendar sync triggered on event confirm/approval"
  - "Notification rules auto-recalculate when event dates change"
  - "Google Calendar OAuth callback added to public paths in middleware"
  - "Smoke test script: 24 Phase 22 endpoint stubs across budget/notification/AI/template/integration"
affects: [phase-23, any-future-notification-work, any-future-integration-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-service wiring via try/catch non-fatal pattern — failures in secondary operations (SMS, Google Calendar) never block primary operations"
    - "Dynamic import pattern for circular-dependency-safe cross-service calls in eventProjectService"
    - "NOTIFICATION_RULES_RECALCULATED activity log entry type for audit trail of reschedule effects"
    - "Smoke test SKIP stub pattern — 24 tests with descriptive skip reasons, no live assertions"

key-files:
  created:
    - scripts/smoke-phase22.mjs
  modified:
    - src/lib/services/eventProjectService.ts
    - src/lib/services/notificationOrchestrationService.ts
    - src/middleware.ts
    - package.json

key-decisions:
  - "Dynamic import used for recalculateRulesForEvent in eventProjectService — prevents circular dependency between eventProjectService and notificationOrchestrationService"
  - "Dynamic import used for syncEventToCalendar in eventProjectService — keeps Google Calendar optional without adding it to module-level imports"
  - "SMS dispatch is fire-and-forget (.catch()) — cron must not block on SMS failures"
  - "resolvePhoneNumbers helper uses rawPrisma — runs inside cron (cross-org, no AsyncLocalStorage context)"
  - "Google Calendar callback added to middleware public paths — OAuth redirect must work without auth cookie"

patterns-established:
  - "Try/catch non-fatal secondary operation pattern: all cross-feature wiring wrapped in try/catch with log.error"
  - "Activity log NOTIFICATION_RULES_RECALCULATED captures ruleId, label, oldScheduledAt, newScheduledAt for each adjusted rule"

requirements-completed:
  - BUD-01
  - BUD-02
  - BUD-03
  - COM-03
  - AI-01
  - AI-02
  - AI-03
  - AI-04
  - AI-05
  - AI-06
  - AI-07
  - AI-08
  - AI-09
  - AI-10
  - AI-11
  - INT-01
  - INT-02
  - INT-03

# Metrics
duration: 4min
completed: 2026-03-16
---

# Phase 22 Plan 10: Integration Wiring & Smoke Tests Summary

**Cross-feature wiring connecting notification reschedule, SMS dispatch, and Google Calendar sync — plus 24-stub smoke test suite for all Phase 22 API endpoints**

## Performance

- **Duration:** ~4 min (Tasks 1-2 complete; Task 3 is human verification checkpoint)
- **Started:** 2026-03-16T02:24:31Z
- **Completed:** 2026-03-16T02:28:22Z (Tasks 1-2)
- **Tasks:** 2 of 3 complete (Task 3 = human verification checkpoint)
- **Files modified:** 5

## Accomplishments

- Wired `recalculateRulesForEvent` into `updateEventProject` — notification rule `scheduledAt` values auto-adjust when event dates change, with activity log entry
- Wired `syncEventToCalendar` into `approveEventProject` and `createEventProject` — Google Calendar pushes to the approver/creator's connected calendar on CONFIRMED status
- Wired SMS delivery into `dispatchPendingNotifications` — after in-app notification, checks Twilio availability and sends bulk SMS to recipients who have phone numbers
- Added `/api/integrations/google-calendar/callback` to middleware public paths so OAuth redirect lands correctly
- Created `scripts/smoke-phase22.mjs` with 24 SKIP stubs covering all Phase 22 endpoints (budget × 7, notifications × 3, AI × 8, templates × 3, integrations × 3)
- Added `smoke:phase22` npm script to package.json

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross-feature wiring and middleware updates** - `c512750` (feat)
2. **Task 2: Smoke tests for Phase 22 endpoints** - `235b734` (feat)
3. **Task 3: Human verification** — Awaiting checkpoint approval

**Plan metadata:** TBD (after checkpoint approval)

## Files Created/Modified

- `src/lib/services/eventProjectService.ts` — Added notification reschedule hook (dynamic import of `recalculateRulesForEvent`), Google Calendar sync on confirm/approve (dynamic import of `syncEventToCalendar`), logger import
- `src/lib/services/notificationOrchestrationService.ts` — Added `twilioService` import, `resolvePhoneNumbers` helper, SMS dispatch block in `dispatchPendingNotifications`
- `src/middleware.ts` — Added `/api/integrations/google-calendar/callback` to public paths
- `scripts/smoke-phase22.mjs` — New: 24 SKIP stub smoke tests for Phase 22
- `package.json` — Added `smoke:phase22` npm script

## Decisions Made

- **Dynamic import for cross-service calls** — `eventProjectService` dynamically imports `notificationOrchestrationService` and `googleCalendarService` to avoid circular module dependencies. This is the same pattern used in Phase 20 for dynamic jsPDF.
- **SMS is fire-and-forget** — `sendBulkSMS` is called with `.catch()` — the cron dispatch must not block or fail due to SMS errors.
- **`resolvePhoneNumbers` uses `rawPrisma`** — Runs inside `dispatchPendingNotifications` which operates in cron context (cross-org, no AsyncLocalStorage org context).
- **Google Calendar sync on approve, not just confirm** — Sync triggered in `approveEventProject` (for DIRECT_REQUEST flow) and `createEventProject` (for PLANNING_SUBMISSION/SERIES auto-confirm flows).

## Deviations from Plan

None — plan executed exactly as written. All cross-feature wiring implemented as specified.

## Issues Encountered

- Pre-existing TypeScript error in `__tests__/lib/assistant-prompt.test.ts` (missing `importance` field in test fixture) — not caused by this plan's changes, pre-existing issue outside scope.

## User Setup Required

None — no new external service configuration required. Twilio and Google Calendar credentials were already handled in Plans 06 and 07.

## Next Phase Readiness

- All Phase 22 cross-feature wiring complete
- Human verification checkpoint (Task 3) required before Phase 22 is officially complete
- Dev server must start clean on port 3004 for verification
- `npm run smoke:phase22` must run all 24 stubs without errors

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*

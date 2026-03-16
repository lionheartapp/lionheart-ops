---
phase: 22-ai-budget-notifications-and-external-integrations
plan: 02
subsystem: api
tags: [prisma, postgresql, notifications, cron, zod, typescript]

# Dependency graph
requires:
  - phase: 21-documents-groups-communication-and-day-of-tools
    provides: EventProject, EventRegistration, EventGroup, EventDocumentCompletion, and org-scoped prisma patterns used by audience resolution
  - phase: 20-registration-and-public-pages
    provides: EventRegistration model and registrantEmail/userId fields needed for audience resolution
provides:
  - EventNotificationRule and EventNotificationLog Prisma models
  - NotificationTriggerType and NotificationRuleStatus enums
  - EVENTS_NOTIFICATIONS_MANAGE permission
  - notificationOrchestrationService with full rule lifecycle
  - 4 API route files for notification rule management
  - Cron endpoint for automated dispatch at scheduled times
affects:
  - 22-05 (Plan 05 AI drafting wires into this service's isAIDrafted flag and messageBody)
  - Any future UI plan building the notification rules tab in EventProject

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "prisma-as-any cast for Phase 22 org-scoped models (same pattern as Phase 21)"
    - "rawPrisma for cron context — cross-org dispatch without org context"
    - "CRON_SECRET Authorization: Bearer header for cron endpoint security"
    - "Audience resolution helper pattern: resolve string like 'group:{id}' or 'unpaid' to userId list"

key-files:
  created:
    - prisma/schema.prisma (EventNotificationRule, EventNotificationLog models + enums)
    - src/lib/types/notification-orchestration.ts
    - src/lib/services/notificationOrchestrationService.ts
    - src/app/api/events/projects/[id]/notifications/route.ts
    - src/app/api/events/projects/[id]/notifications/[ruleId]/route.ts
    - src/app/api/events/projects/[id]/notifications/[ruleId]/approve/route.ts
    - src/app/api/cron/event-notifications/route.ts
  modified:
    - prisma/schema.prisma (notificationRules relation on EventProject, back-relations on User and Organization)
    - src/lib/db/index.ts (EventNotificationRule + EventNotificationLog in orgScopedModels)
    - src/lib/permissions.ts (EVENTS_NOTIFICATIONS_MANAGE constant + added to ADMIN role)

key-decisions:
  - "EventNotificationLog uses hard delete (no soft delete) — log rows are immutable audit records, cancellation changes rule status not log rows"
  - "dispatchPendingNotifications uses rawPrisma — cron runs cross-org without org context"
  - "resolveAudience is an internal helper, not exported — audience resolution is an implementation detail of dispatch"
  - "cancelRule allows any non-SENT status transition — simpler than restricting to specific states"
  - "recalculateRulesForEvent only adjusts DATE_BASED rules — CONDITION_BASED and ACTION_TRIGGERED have no scheduledAt"
  - "Notification type 'event_updated' used for in-app delivery — closest existing type; Plan 05 AI integration may add dedicated event_notification type"

patterns-established:
  - "Approval workflow pattern: DRAFT → PENDING_APPROVAL → APPROVED → SENT lifecycle with single POST /approve endpoint accepting action param"
  - "Audience string encoding pattern: 'all', 'registered', 'group:{id}', 'incomplete_docs', 'unpaid' resolved in resolveAudience helper"

requirements-completed:
  - COM-03

# Metrics
duration: 7min
completed: 2026-03-16
---

# Phase 22 Plan 02: Notification Orchestration Summary

**Event notification rule lifecycle with DRAFT/PENDING_APPROVAL/APPROVED/SENT workflow, date-based scheduling with reschedule recalculation, and cron-based dispatch via CRON_SECRET-authenticated endpoint**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-16T01:54:18Z
- **Completed:** 2026-03-16T02:01:30Z
- **Tasks:** 2
- **Files modified:** 10 (4 modified, 7 created)

## Accomplishments

- 2 Prisma models (EventNotificationRule, EventNotificationLog) with 2 enums pushed to database
- Complete rule lifecycle service: CRUD, submit/approve/cancel workflow, scheduledAt recalculation on reschedule, cron dispatch
- 4 API routes covering all rule management operations and workflow transitions
- Cron endpoint dispatches approved notifications and creates audit log entries

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification orchestration schema, permissions, and client types** - `b2b2fd5` (feat)
2. **Task 2: Notification orchestration service and API routes** - `d281aa2` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `prisma/schema.prisma` - Added EventNotificationRule, EventNotificationLog, enums, back-relations
- `src/lib/db/index.ts` - Registered new models in orgScopedModels
- `src/lib/permissions.ts` - Added EVENTS_NOTIFICATIONS_MANAGE, added to ADMIN role
- `src/lib/types/notification-orchestration.ts` - Zod schema, CONDITION_TYPES, ACTION_TYPES, response types
- `src/lib/services/notificationOrchestrationService.ts` - Full service with all exported functions
- `src/app/api/events/projects/[id]/notifications/route.ts` - GET list + POST create
- `src/app/api/events/projects/[id]/notifications/[ruleId]/route.ts` - PATCH update + DELETE
- `src/app/api/events/projects/[id]/notifications/[ruleId]/approve/route.ts` - POST with action param
- `src/app/api/cron/event-notifications/route.ts` - Cron dispatch endpoint

## Decisions Made

- EventNotificationLog uses hard delete (no soft delete) — log rows are immutable audit records
- dispatchPendingNotifications uses rawPrisma — cron runs cross-org without org context
- resolveAudience is an internal helper — audience resolution is an implementation detail of dispatch
- cancelRule allows any non-SENT status — simpler than restricting to specific states
- recalculateRulesForEvent only adjusts DATE_BASED rules — CONDITION_BASED and ACTION_TRIGGERED have no scheduledAt
- Notification type 'event_updated' used for in-app delivery — closest existing type pending Plan 05 AI integration

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ZodError property name in API routes**
- **Found during:** Task 2 (API routes compilation)
- **Issue:** Used `.errors` property on ZodError but Zod uses `.issues` — TypeScript compilation error
- **Fix:** Changed `parsed.error.errors.map(...)` to `parsed.error.issues` in both notification routes
- **Files modified:** notifications/route.ts, notifications/[ruleId]/route.ts
- **Verification:** `npx tsc --noEmit` passes with only pre-existing test error
- **Committed in:** d281aa2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor fix to match project's existing ZodError usage pattern (seen in incidents, share routes). No scope creep.

## Issues Encountered

- Pre-existing TypeScript error in `__tests__/lib/assistant-prompt.test.ts:158` (missing `importance` field) — unrelated to this plan, out of scope per deviation rules

## Next Phase Readiness

- Notification rule data layer complete; Plan 05 can wire AI drafting into `isAIDrafted` flag and `messageBody`
- recalculateRulesForEvent should be called from event PATCH handler when `startsAt` changes (wiring into event update flow is a future concern)
- UI tab for notification rules in EventProject can be built against these API routes

## Self-Check: PASSED

All artifacts verified:
- notificationOrchestrationService.ts: FOUND
- notification-orchestration.ts types: FOUND
- 4 API route files: FOUND
- cron/event-notifications/route.ts: FOUND
- b2b2fd5 (Task 1 commit): FOUND
- d281aa2 (Task 2 commit): FOUND
- EventNotificationRule in schema: FOUND
- EventNotificationLog in schema: FOUND
- NotificationTriggerType enum: FOUND

---
*Phase: 22-ai-budget-notifications-and-external-integrations*
*Completed: 2026-03-16*

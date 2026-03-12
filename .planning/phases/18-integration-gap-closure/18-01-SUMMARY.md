---
phase: 18-integration-gap-closure
plan: "01"
subsystem: notifications, ai-routes, middleware
tags: [notifications, preferences, observability, pino, sentry, rate-limiting, tdd]
dependency_graph:
  requires: []
  provides:
    - "Preference-filtered createBulkNotifications (INT-01 closed)"
    - "Pino + Sentry instrumented AI routes (INT-02 closed)"
    - "Rate-limited resend-verification endpoint (INT-03 closed)"
  affects:
    - "src/lib/services/notificationService.ts"
    - "src/app/api/ai/generate-description/route.ts"
    - "src/app/api/ai/parse-event/route.ts"
    - "src/app/api/ai/assistant/chat/route.ts"
    - "src/middleware.ts"
tech_stack:
  added: []
  patterns:
    - "rawPrisma batch preference lookup before createMany"
    - "logger.child per-route + Sentry.captureException in catch blocks"
    - "module-level routeLog for routes with multiple catch sites"
key_files:
  created:
    - "__tests__/lib/notificationService.test.ts"
    - "__tests__/api/ai-routes.test.ts"
  modified:
    - "src/lib/services/notificationService.ts"
    - "src/app/api/ai/generate-description/route.ts"
    - "src/app/api/ai/parse-event/route.ts"
    - "src/app/api/ai/assistant/chat/route.ts"
    - "src/middleware.ts"
decisions:
  - "rawPrisma used for both notificationPreference and user lookups — model not in org-scoped whitelist per Phase 12 decision"
  - "module-level routeLog in chat route (not per-handler) — route has multiple catch sites including safeAsync helper and inner stream catch"
  - "Sentry.setTag('org_id') skipped in generate-description and parse-event — no orgId available (no getOrgIdFromRequest call); added in chat route which does have orgId"
  - "disabledSet uses userId:type composite key strings for O(1) lookup without nested iteration"
metrics:
  duration_seconds: 244
  completed_date: "2026-03-12"
  tasks_completed: 2
  files_modified: 7
  tests_added: 9
---

# Phase 18 Plan 01: Integration Gap Closure Summary

**One-liner:** Closes all 3 v2.0 integration gaps — batch preference-filtered bulk notifications using rawPrisma + Pino/Sentry instrumentation on 3 AI routes + resend-verification rate limiting in middleware.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for bulk notification preference filtering | c95319a | `__tests__/lib/notificationService.test.ts` |
| 1 (GREEN) | Preference-filtered createBulkNotifications | 9bc4fa8 | `src/lib/services/notificationService.ts` |
| 2 | AI route observability + middleware rate limit + tests | e86a4f6 | 4 production files + `__tests__/api/ai-routes.test.ts` |

## What Was Built

### INT-01: Bulk Notifications Now Respect User Preferences

`createBulkNotifications` previously called `prisma.notification.createMany` for all recipients without checking preferences. Now it:

1. Collects unique `userIds` from the batch
2. Batch-fetches `pauseAllNotifications` flags via `rawPrisma.user.findMany`
3. Batch-fetches explicitly disabled per-type preferences via `rawPrisma.notificationPreference.findMany` (with `inAppEnabled: false` filter)
4. Builds `pausedSet` (Set of userId) and `disabledSet` (Set of `${userId}:${type}` composite strings)
5. Filters the input items to only eligible recipients
6. Returns early if no eligible items remain (never calls `createMany`)
7. Passes only eligible items to `prisma.notification.createMany`

Both lookups use `rawPrisma` because `NotificationPreference` is not in the org-scoped model whitelist in `db/index.ts`.

### INT-02: AI Route Observability

All 3 previously uninstrumented AI routes now have Pino + Sentry:

- **generate-description**: `logger.child` per-handler, `log.error` + `Sentry.captureException` in INTERNAL_ERROR catch branch
- **parse-event**: Same pattern as generate-description
- **assistant/chat**: Module-level `routeLog` (needed for safeAsync helper + 2 catch sites), `Sentry.setTag('org_id')` after orgId extraction, `routeLog.error` + `Sentry.captureException` in both inner stream catch and outer catch, safeAsync uses `routeLog.error` instead of `console.error`

No `console.error` calls remain in any of the 3 AI route files.

### INT-03: Resend-Verification Rate Limiting

`/api/auth/resend-verification` was already in `isPublicPath` but was missing from the `publicApiRateLimiter` branch. Added a 1-line `|| pathname.startsWith('/api/auth/resend-verification')` condition to the existing `else if` chain. The endpoint now gets the same 30 req/min protection as forgot-password, set-password, and reset-password.

## Test Results

All 47 tests pass (7 test files):

```
✓ __tests__/lib/pagination.test.ts (15 tests)
✓ __tests__/lib/org-context.test.ts (4 tests)
✓ __tests__/lib/notificationService.test.ts (5 tests)  ← NEW
✓ __tests__/lib/permissions.test.ts (9 tests)
✓ __tests__/lib/auth.test.ts (4 tests)
✓ __tests__/api/ai-routes.test.ts (4 tests)            ← NEW
✓ __tests__/api/tickets.test.ts (6 tests)
```

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Added logger import + log constant to notificationService**
- Found during: Task 1 GREEN phase
- Issue: The plan specified replacing `console.error` with `log.error` in the catch block, but `logger` was not imported
- Fix: Added `import { logger } from '@/lib/logger'` and `const log = logger.child({ service: 'notificationService' })` at the top of the file
- Files modified: `src/lib/services/notificationService.ts`
- Note: Also replaced `console.error` in `createNotification` catch (not just `createBulkNotifications`) for consistency

No other deviations — plan executed as specified.

## Decisions Made

1. **rawPrisma for preference lookups** — `NotificationPreference` is not in the org-scoped whitelist in `db/index.ts`. Decision confirmed by Phase 12 STATE.md entry: "NotificationPreference queries use rawPrisma".

2. **Module-level routeLog in chat route** — The chat route has 3 separate sites that need logging: the `safeAsync` helper (module level), the inner stream `catch`, and the outer `catch`. A module-level logger avoids declaring it in each scope and matches the established pattern from Phase 13.

3. **Sentry.setTag skipped in generate-description and parse-event** — These routes do not call `getOrgIdFromRequest()`, so there is no `orgId` to tag. Per the plan (pitfall 3), we skip the setTag call for these routes. The chat route has `orgId` and does call `Sentry.setTag`.

4. **disabledSet composite key** — `${userId}:${type}` string keys in the Set provide O(1) lookup without nested loops over the preferences array for each item.

## Self-Check: PASSED

All production files exist, all test files exist, all 3 task commits verified.

| Artifact | Status |
|----------|--------|
| `src/lib/services/notificationService.ts` | FOUND |
| `src/app/api/ai/generate-description/route.ts` | FOUND |
| `src/app/api/ai/parse-event/route.ts` | FOUND |
| `src/app/api/ai/assistant/chat/route.ts` | FOUND |
| `src/middleware.ts` | FOUND |
| `__tests__/lib/notificationService.test.ts` | FOUND |
| `__tests__/api/ai-routes.test.ts` | FOUND |
| Commit c95319a (RED: failing tests) | FOUND |
| Commit 9bc4fa8 (GREEN: implementation) | FOUND |
| Commit e86a4f6 (Task 2: observability + tests) | FOUND |

---
phase: 16-billing-permission-observability-retrofit
plan: "02"
subsystem: observability
tags: [logging, sentry, pino, instrumentation, api-routes]
dependency_graph:
  requires: [13-02, 13-03]
  provides: [full-route-observability]
  affects: [all-api-routes]
tech_stack:
  added: []
  patterns: [pino-child-logger, sentry-capture-exception, logger-child-before-try]
key_files:
  created: []
  modified:
    - src/app/api/inventory/[id]/route.ts
    - src/app/api/inventory/[id]/checkout/route.ts
    - src/app/api/inventory/[id]/checkin/route.ts
    - src/app/api/inventory/[id]/transactions/route.ts
    - src/app/api/draft-events/[id]/route.ts
    - src/app/api/tickets/[id]/route.ts
    - src/app/api/tickets/[id]/comments/route.ts
    - src/app/api/tickets/[id]/attachments/route.ts
    - src/app/api/settings/billing/route.ts
    - src/app/api/settings/billing/change-plan/route.ts
    - src/app/api/settings/billing/portal/route.ts
    - src/app/api/settings/billing/invoices/route.ts
    - src/app/api/settings/organization/route.ts
    - src/app/api/user/notification-preferences/route.ts
    - src/app/api/settings/export/users/route.ts
    - src/app/api/settings/export/tickets/route.ts
    - src/app/api/settings/export/events/route.ts
    - src/app/api/public/contact/route.ts
    - src/app/api/auth/me/route.ts
    - src/app/api/auth/logout/route.ts
    - src/app/api/auth/resend-verification/route.ts
decisions:
  - "auth/logout wrapped in try/catch for consistency even though cookie clearing never throws"
  - "auth/me Sentry.setTag placed after claims verification (uses claims.organizationId) not getOrgIdFromRequest"
  - "resend-verification email-not-sent log downgraded from console.error to log.warn (not an application error)"
  - "public/contact has no Sentry.setTag per plan spec (public route, no orgId)"
  - "billing routes rawPrisma imports preserved per plan requirement"
metrics:
  duration: "~7min"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 21
---

# Phase 16 Plan 02: Observability Retrofit for Post-Phase-13 Routes Summary

Pino structured logging and Sentry error tracking added to all 21 API routes created after Phase 13 established the instrumentation pattern, closing production monitoring blind spots.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Instrument inventory, draft-events, and ticket sub-resource routes | b311b4b | 8 files |
| 2 | Instrument billing, settings, export, auth, and public routes | 1c6dfcf | 13 files |

## What Was Built

All 21 API routes from Phases 10-15 now follow the canonical instrumentation pattern from Phase 13:

```typescript
const log = logger.child({ route: '/api/example', method: 'GET' })
try {
  const orgId = getOrgIdFromRequest(req)
  Sentry.setTag('org_id', orgId)
  // ... business logic unchanged ...
} catch (error) {
  log.error({ err: error }, 'Failed to [action]')
  Sentry.captureException(error)
  return NextResponse.json(fail('INTERNAL_ERROR', '...'), { status: 500 })
}
```

### Route Categories Instrumented

**Inventory routes (4 files):** `inventory/[id]` GET/PUT/DELETE, `checkout` POST, `checkin` POST, `transactions` GET

**Ticket sub-resource routes (3 files):** `tickets/[id]` GET/PUT/DELETE, `comments` GET/POST, `attachments` GET/POST

**Draft events (1 file):** `draft-events/[id]` GET/PUT/DELETE

**Billing routes (4 files):** `billing` GET, `billing/change-plan` POST, `billing/portal` POST, `billing/invoices` GET — rawPrisma preserved per plan spec

**Settings routes (2 files):** `settings/organization` GET/PATCH, `user/notification-preferences` GET/PUT

**Export routes (3 files):** `export/users` GET, `export/tickets` GET, `export/events` GET

**Auth routes (3 files):** `auth/me` GET (Sentry.setTag uses `claims.organizationId`), `auth/logout` POST (wrapped in try/catch), `auth/resend-verification` POST

**Public route (1 file):** `public/contact` POST — no Sentry.setTag (no orgId available)

## Deviations from Plan

**1. [Rule 2 - Enhancement] auth/logout wrapped in try/catch**
- **Found during:** Task 2
- **Issue:** The `auth/logout` route had no try/catch block at all — just synchronous cookie manipulation. While it cannot currently throw, adding try/catch is required for the instrumentation pattern and is forward-compatible.
- **Fix:** Wrapped the handler body in try/catch with log.error + Sentry.captureException in catch.
- **Files modified:** `src/app/api/auth/logout/route.ts`
- **Commit:** 1c6dfcf

**2. [Rule 1 - Bug] resend-verification email warning log downgraded**
- **Found during:** Task 2
- **Issue:** `console.error('[POST /api/auth/resend-verification] Email not sent:', emailResult.reason)` was logging email send failure as an error, but this is an expected degraded state (Resend not configured), not an application crash.
- **Fix:** Replaced with `log.warn({ reason: emailResult.reason }, 'Verification email not sent')` — correctly classified as warning, and uses `reason` key (not email address) for FERPA compliance.
- **Files modified:** `src/app/api/auth/resend-verification/route.ts`
- **Commit:** 1c6dfcf

## Verification Results

- All 21 routes have `from '@/lib/logger'` import: grep returns 0 (all present)
- All 21 routes have `Sentry.captureException`: grep returns 0 (all present)
- TypeScript compilation: `npx tsc --noEmit` — passes with zero errors
- Architecture check: passed on both commits

## Self-Check: PASSED

Files verified present:
- src/app/api/inventory/[id]/route.ts — FOUND, contains logger
- src/app/api/settings/billing/route.ts — FOUND, contains Sentry.captureException
- src/app/api/public/contact/route.ts — FOUND, contains logger, no Sentry.setTag
- src/app/api/auth/me/route.ts — FOUND, contains Sentry.captureException

Commits verified:
- b311b4b (Task 1) — present in git log
- 1c6dfcf (Task 2) — present in git log

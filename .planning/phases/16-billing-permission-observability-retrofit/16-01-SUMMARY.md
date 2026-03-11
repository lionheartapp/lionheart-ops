---
phase: 16-billing-permission-observability-retrofit
plan: "01"
subsystem: auth
tags: [permissions, rbac, prisma, vitest, backfill]

# Dependency graph
requires:
  - phase: 12-settings-and-admin-tools
    provides: Billing routes using assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)
provides:
  - SETTINGS_BILLING added to DEFAULT_ROLES.ADMIN permissions array
  - Backfill script for existing organizations
  - Unit test coverage for admin billing permission
affects:
  - 16-billing-permission-observability-retrofit (subsequent plans)
  - any org seeding or role migration scripts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD for permissions constants: write failing test against DEFAULT_ROLES, then fix the constant"
    - "Backfill script pattern: upsert Permission row globally, find all admin roles, create RolePermission per role, catch P2002 for idempotency"

key-files:
  created:
    - scripts/backfill-billing-permission.mjs
  modified:
    - src/lib/permissions.ts
    - __tests__/lib/permissions.test.ts

key-decisions:
  - "SETTINGS_BILLING added immediately after SETTINGS_UPDATE in admin permissions array for grouping consistency"
  - "Backfill script excludes super-admin roles — *:* wildcard already covers settings:billing"
  - "Backfill uses scope: 'global' (not null or empty string) matching organizationRegistrationService.ts convention"

patterns-established:
  - "Billing permission backfill: upsert global Permission row, iterate admin roles, create RolePermission, catch P2002"

requirements-completed: [SET-02]

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 16 Plan 01: Billing Permission Retrofit Summary

**SETTINGS_BILLING added to DEFAULT_ROLES.ADMIN in permissions.ts with TDD unit test and idempotent backfill script for existing orgs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T18:59:59Z
- **Completed:** 2026-03-11T19:02:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `PERMISSIONS.SETTINGS_BILLING` to `DEFAULT_ROLES.ADMIN.permissions` array in `src/lib/permissions.ts` — new orgs created via `seedOrgDefaults` will automatically receive the permission
- Created `__tests__/lib/permissions.test.ts` `DEFAULT_ROLES` describe block with 2 tests (TDD: RED confirmed before fix, GREEN confirmed after)
- Created `scripts/backfill-billing-permission.mjs` — idempotent one-time script for existing orgs that upserts the permission row and creates RolePermission junction rows for all admin roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SETTINGS_BILLING to admin role and write unit test** - `988fcb3` (feat)
2. **Task 2: Create billing permission backfill script for existing orgs** - `622a20c` (feat)

**Plan metadata:** (docs commit below)

_Note: Task 1 used TDD — test written first (RED: 1 fail), then fix applied (GREEN: all 9 pass)_

## Files Created/Modified

- `src/lib/permissions.ts` — Added `PERMISSIONS.SETTINGS_BILLING` to `DEFAULT_ROLES.ADMIN.permissions` array at line 264, with comment `// Billing tab access — added Phase 16`
- `__tests__/lib/permissions.test.ts` — Added `describe('DEFAULT_ROLES')` block: asserts ADMIN.permissions includes SETTINGS_BILLING, and that SETTINGS_BILLING equals 'settings:billing'
- `scripts/backfill-billing-permission.mjs` — One-time backfill for existing orgs: upserts permission row, creates RolePermission for every admin role, P2002 catch for idempotency, logs added/skipped counts

## Decisions Made

- SETTINGS_BILLING placed immediately after SETTINGS_UPDATE in the admin permissions array for logical grouping (all settings:* permissions together)
- Backfill script excludes super-admin — `*:*` wildcard already grants all permissions including billing
- Scope field set to `'global'` (not null or empty) matching the convention in `organizationRegistrationService.ts` and `backfill-new-roles.mjs`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

After this plan is deployed, run the backfill against production:

```bash
node scripts/backfill-billing-permission.mjs
```

This must be run once against production DB to grant billing access to existing admin-role users.

## Next Phase Readiness

- SET-02 gap closed: admin users will no longer receive 403 on billing routes
- Backfill script ready to run against production DB
- Proceed to next plan in phase 16

---
*Phase: 16-billing-permission-observability-retrofit*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: src/lib/permissions.ts
- FOUND: scripts/backfill-billing-permission.mjs
- FOUND: __tests__/lib/permissions.test.ts
- FOUND: .planning/phases/16-billing-permission-observability-retrofit/16-01-SUMMARY.md
- FOUND commit: 988fcb3 (Task 1)
- FOUND commit: 622a20c (Task 2)

---
phase: 16-billing-permission-observability-retrofit
verified: 2026-03-11T20:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 16: Billing Permission & Observability Retrofit Verification Report

**Phase Goal:** Close the last 3 audit gaps — billing permission assignment for admin users and Pino/Sentry instrumentation for 21 routes added after Phase 13
**Verified:** 2026-03-11T20:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Admin-role users can access all 4 billing API routes without 403 — SETTINGS_BILLING assigned to admin role | VERIFIED | `DEFAULT_ROLES.ADMIN.permissions` includes `PERMISSIONS.SETTINGS_BILLING` at line 264 of `src/lib/permissions.ts`; all 4 billing routes call `assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)` |
| 2 | All 21 routes from Phases 10-15 have `logger.child({ route, method })` Pino instrumentation | VERIFIED | `grep -rL "from '@/lib/logger'"` across all 21 files returns 0; every handler has `const log = logger.child(...)` before try block |
| 3 | All 21 routes from Phases 10-15 have `Sentry.captureException(error)` in catch blocks | VERIFIED | `grep -rL "Sentry.captureException"` across all 21 files returns 0; all outer catch blocks contain `Sentry.captureException(error)` |
| 4 | SETTINGS_BILLING permission is in DEFAULT_ROLES.ADMIN.permissions array | VERIFIED | `grep -n "SETTINGS_BILLING" src/lib/permissions.ts` shows it at line 47 (constant definition) AND line 264 (inside ADMIN permissions array) |
| 5 | Existing orgs can receive the billing permission via backfill script | VERIFIED | `scripts/backfill-billing-permission.mjs` exists at 81 lines, contains `prisma.rolePermission.create`, catches P2002 for idempotency, logs added/skipped counts |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/lib/permissions.ts` | SETTINGS_BILLING in ADMIN role permissions array | VERIFIED | Line 264: `PERMISSIONS.SETTINGS_BILLING, // Billing tab access — added Phase 16` |
| `scripts/backfill-billing-permission.mjs` | One-time DB migration for existing orgs, min 30 lines | VERIFIED | 81 lines; upserts permission, iterates admin roles, creates RolePermission, catches P2002 |
| `__tests__/lib/permissions.test.ts` | Unit test verifying ADMIN role includes SETTINGS_BILLING | VERIFIED | `DEFAULT_ROLES` describe block at lines 129-135: two tests for SETTINGS_BILLING presence and value |
| `src/app/api/inventory/[id]/route.ts` | Instrumented inventory item CRUD | VERIFIED | GET/PUT/DELETE all have `logger.child`, `Sentry.setTag('org_id', orgId)`, `log.error`, `Sentry.captureException` |
| `src/app/api/settings/billing/route.ts` | Instrumented billing route, contains Sentry.captureException | VERIFIED | `logger` import at line 8, `Sentry.captureException` at line 48 |
| `src/app/api/public/contact/route.ts` | Instrumented public contact route — no Sentry.setTag org_id | VERIFIED | Has `logger.child`, `Sentry.captureException`; no `Sentry.setTag('org_id')` per spec |
| `src/app/api/auth/me/route.ts` | Instrumented auth me route | VERIFIED | `logger.child` at line 16; `Sentry.setTag('org_id', claims.organizationId)` at line 33; `Sentry.captureException` at line 90 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/lib/permissions.ts` | `src/app/api/settings/billing/route.ts` | `assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)` | WIRED | All 4 billing routes call assertCan with SETTINGS_BILLING: billing/route.ts line 17, change-plan line 30, portal line 24, invoices line 34 |
| `scripts/backfill-billing-permission.mjs` | `prisma.permission + prisma.rolePermission` | `rolePermission.create` | WIRED | Line 56: `await prisma.rolePermission.create({...})` with P2002 catch at line 64 |
| All 21 route files | `src/lib/logger.ts` | `import { logger } from '@/lib/logger'` | WIRED | grep returns 0 missing files across all 21 routes |
| All 21 route files | `@sentry/nextjs` | `Sentry.captureException` | WIRED | grep returns 0 missing files across all 21 routes |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SET-02 | 16-01-PLAN.md | Org admin can view and manage their billing/subscription plan | SATISFIED | SETTINGS_BILLING added to ADMIN role permissions at line 264 of permissions.ts; all 4 billing routes enforce this permission via assertCan; backfill script ready for existing orgs |
| INFRA-03 | 16-02-PLAN.md | Application uses structured JSON logging (Pino) with log levels instead of console.error | SATISFIED | All 21 routes instrumented with `logger.child({ route, method })` before try block; `log.error({ err: error }, '...')` in all outer catch blocks |
| INFRA-04 | 16-02-PLAN.md | Runtime errors are captured and reported to Sentry with context | SATISFIED | All 21 routes import `* as Sentry from '@sentry/nextjs'`; `Sentry.captureException(error)` in all outer catch blocks; `Sentry.setTag('org_id', orgId)` where orgId is available |

**Note on REQUIREMENTS.md tracking table:** SET-02, INFRA-03, INFRA-04 appear in the coverage table under Phases 12 and 13 respectively — Phase 16 is a gap closure phase that satisfies the integration aspects these requirements needed, not a new requirement assignment. The REQUIREMENTS.md `[x]` marks for all three requirements are correct.

**Note on ROADMAP.md plan checkboxes:** The `16-01-PLAN.md` and `16-02-PLAN.md` entries in ROADMAP.md remain as `[ ]` (unchecked). All code evidence and commit history confirm the plans were fully executed (commits 988fcb3, 622a20c, b311b4b, 1c6dfcf). The ROADMAP.md checkbox state is a documentation tracking artifact, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/app/api/settings/billing/change-plan/route.ts` | 125, 166, 222, 272 | `console.error` in inner Stripe-specific catch blocks | Info | Acceptable — these are nested `catch (stripeError)` blocks that handle Stripe API failures gracefully (fall through or return degraded response). The outer `catch (error)` at line 277 is correctly instrumented with `log.error` + `Sentry.captureException`. |
| `src/app/api/settings/billing/portal/route.ts` | 71 | `console.error` in inner Stripe catch block | Info | Same pattern as above — nested Stripe error handler, outer catch at line 76 is correctly instrumented. |
| `src/app/api/settings/billing/invoices/route.ts` | 72 | `console.error` in inner Stripe catch block (fall-through) | Info | Same pattern — inner catch falls through to local Payment table fallback. Outer catch at line 96 is correctly instrumented. |
| `scripts/backfill-billing-permission.mjs` | 78 | `console.error(e)` in error handler | Info | Script-level error (not production API route). Acceptable for a one-shot CLI script. No logging library available in plain Node.js scripts. |

No blocker or warning anti-patterns found. All `console.error` occurrences are either in non-production scripts or nested Stripe sub-catches with properly instrumented outer catch blocks.

### Human Verification Required

None. All success criteria are mechanically verifiable via code inspection.

### Gaps Summary

No gaps. All three audit gap closures are fully implemented and verified:

1. **SET-02 (Billing Permission):** `PERMISSIONS.SETTINGS_BILLING` is present in both the `PERMISSIONS` constant (line 47) and `DEFAULT_ROLES.ADMIN.permissions` array (line 264) of `src/lib/permissions.ts`. All 4 billing routes enforce it via `assertCan`. Unit test coverage confirms the fix. Backfill script exists for existing orgs.

2. **INFRA-03 (Pino Logging):** All 21 routes have `logger.child({ route, method })` before their try blocks with `log.error({ err: error }, '...')` in outer catch blocks. No production route files use bare `console.error` in their main error paths.

3. **INFRA-04 (Sentry):** All 21 routes import Sentry and call `Sentry.captureException(error)` in outer catch blocks. Routes with accessible orgId also call `Sentry.setTag('org_id', orgId)`. The public contact route correctly omits the org_id tag per spec.

---

_Verified: 2026-03-11T20:00:00Z_
_Verifier: Claude (gsd-verifier)_

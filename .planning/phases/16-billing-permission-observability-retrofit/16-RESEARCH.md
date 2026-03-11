# Phase 16: Billing Permission & Observability Retrofit - Research

**Researched:** 2026-03-11
**Domain:** Permission system backfill, Pino/Sentry instrumentation retrofit, multi-tenant role management
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SET-02 | Org admin can view and manage their billing/subscription plan | Add `PERMISSIONS.SETTINGS_BILLING` to `DEFAULT_ROLES.ADMIN.permissions` in `src/lib/permissions.ts`; write a one-shot backfill script to assign the permission to existing admin roles in the DB |
| INFRA-03 | Application uses structured JSON logging (Pino) with log levels instead of console.error | Apply the Phase 13 `logger.child({ route, method })` pattern to 21 routes added after Phase 13 executed |
| INFRA-04 | Runtime errors are captured and reported to Sentry with context | Apply `Sentry.captureException(error)` to the catch block of each of the same 21 routes |
</phase_requirements>

---

## Summary

Phase 16 is a precision retrofit phase that closes three integration gaps discovered in the v2.0 milestone audit. The gaps are not design problems — the infrastructure (Pino logger, Sentry, permission system) is fully functional. The gaps arose because Phase 13 (observability) executed before Phases 10-15 added 21 new API routes, and Phase 12 (billing) defined `SETTINGS_BILLING` in `DEFAULT_ROLES.ADMIN` but the permission was never added to the array.

The work is split into two independent concerns. First: a one-line change to `src/lib/permissions.ts` (add `PERMISSIONS.SETTINGS_BILLING` to the admin role) plus a backfill script to assign that permission to the admin role in all existing orgs already in the database. Second: a mechanical instrumentation pass over 21 route files, adding two imports and two statements per handler function — zero business logic changes.

Both tasks are low-risk, high-confidence, and verifiable with automated checks. The only operational consideration is the permission backfill: the `permissions.ts` change only affects new organizations created after Phase 16. Existing orgs need a one-time DB migration via a script following the established `backfill-new-roles.mjs` pattern.

**Primary recommendation:** Execute in two sequential tasks — (1) permission fix + backfill script, (2) instrumentation retrofit of all 21 routes. Both tasks are single-wave, no dependencies on external services.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| pino | ^9.x | Structured JSON logging | Installed in Phase 13 |
| @sentry/nextjs | ^8.28.0+ | Error tracking | Installed in Phase 13 |
| @prisma/client | ^5.22 | DB operations for backfill | Installed |

### Supporting (already in codebase)

| File | Purpose | Pattern |
|------|---------|---------|
| `src/lib/logger.ts` | Pino singleton — `logger.child({ route, method })` | Established in Phase 13 |
| `src/sentry.server.config.ts` | Sentry init with `sendDefaultPii: false` | Established in Phase 13 |
| `src/lib/permissions.ts` | `DEFAULT_ROLES` and `PERMISSIONS` constants | Source of truth for role definitions |

**Installation:** None required. All dependencies are already installed.

---

## Architecture Patterns

### Pattern 1: The Pino Child Logger (Established — Must Match Exactly)

**What:** Each handler function creates a child logger at the top with `{ route, method }` fields. Errors use `log.error({ err: error }, 'message')` — the `err` key triggers Pino's error serializer (includes stack trace). `Sentry.captureException(error)` fires immediately after in the same catch block.

**Reference implementation** (from `src/app/api/tickets/route.ts`, installed in Phase 13):

```typescript
// Source: src/app/api/tickets/route.ts (existing instrumented route)
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/tickets', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    // ...
    Sentry.setTag('org_id', orgId)
    // ... business logic ...
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch tickets')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', '...'), { status: 500 })
  }
}
```

**Key rules (from STATE.md Phase 13 decisions):**
- `Sentry.setTag('org_id', orgId)` placed AFTER orgId extraction
- `Sentry.setTag('user_role', ctx.roleName)` if ctx is available — never email or name
- `logger.child({ route, method })` called once per handler function (not once per file)
- `log` is created at top of handler (before try) so catch block can use it
- Do NOT log request bodies, email addresses, names, student data (FERPA)
- Do NOT import logger in `src/middleware.ts` (Edge runtime — no worker_threads)

### Pattern 2: Permission Backfill (Established — Follow backfill-new-roles.mjs)

**What:** Adding a permission to `DEFAULT_ROLES.ADMIN` in `permissions.ts` only affects new orgs created after the change. Every existing org has its own copy of the admin role in the `Role` table with its own `RolePermission` junction rows — these are not automatically updated.

**Two-part fix required:**
1. Add `PERMISSIONS.SETTINGS_BILLING` to `DEFAULT_ROLES.ADMIN.permissions` array in `src/lib/permissions.ts`
2. Run a one-time backfill script that:
   - Finds the `settings:billing` permission row in the global `Permission` table (or upserts it if absent)
   - Finds the `admin` role for every organization
   - Creates a `RolePermission` row linking them (idempotent — skip if already exists)

**Established script pattern** (from `scripts/backfill-new-roles.mjs`):

```javascript
// Pattern: scripts/backfill-billing-permission.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Step 1: Upsert the permission row (global, shared across orgs)
  const permRow = await prisma.permission.upsert({
    where: { resource_action_scope: { resource: 'settings', action: 'billing', scope: 'global' } },
    create: { resource: 'settings', action: 'billing', scope: 'global' },
    update: {},
    select: { id: true },
  })

  // Step 2: Find admin role for every org
  const adminRoles = await prisma.role.findMany({
    where: { slug: 'admin' },
    select: { id: true, organizationId: true },
  })

  // Step 3: Assign permission to each admin role (idempotent)
  let added = 0, skipped = 0
  for (const role of adminRoles) {
    const existing = await prisma.rolePermission.findUnique({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permRow.id } },
    })
    if (existing) { skipped++; continue }
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permRow.id },
    })
    added++
  }

  console.log(`Done: added ${added}, skipped ${skipped} (already had permission)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

**Critical:** `SETTINGS_BILLING` maps to `{ resource: 'settings', action: 'billing', scope: 'global' }`. Verify the scope value by checking how `parsePermissionString('settings:billing')` handles 2-part strings — in `organizationRegistrationService.ts` the scope defaults to `'global'` when the third segment is absent.

**Permission cache:** After the backfill runs, existing logged-in admin users will get the new permission within 30 seconds (cache TTL). No forced re-login needed. `clearPermissionCache(userId)` is available if an immediate flush is required.

### Pattern 3: Route-by-Route Mapping for the 21 Routes

The audit identified exactly 21 routes. All 21 are confirmed missing both `logger` import and `Sentry.captureException` (verified by grep). Below is the complete map:

**Inventory (4 routes):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/inventory/[id]/route.ts` | `/api/inventory/[id]` | GET, PATCH, DELETE |
| `src/app/api/inventory/[id]/checkout/route.ts` | `/api/inventory/[id]/checkout` | POST |
| `src/app/api/inventory/[id]/checkin/route.ts` | `/api/inventory/[id]/checkin` | POST |
| `src/app/api/inventory/[id]/transactions/route.ts` | `/api/inventory/[id]/transactions` | GET |

**Draft Events (1 route):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/draft-events/[id]/route.ts` | `/api/draft-events/[id]` | GET, PUT, DELETE |

**Tickets sub-resources (3 routes):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/tickets/[id]/route.ts` | `/api/tickets/[id]` | GET, PUT, PATCH, DELETE |
| `src/app/api/tickets/[id]/comments/route.ts` | `/api/tickets/[id]/comments` | GET, POST |
| `src/app/api/tickets/[id]/attachments/route.ts` | `/api/tickets/[id]/attachments` | GET, POST, DELETE |

**Billing (4 routes):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/settings/billing/route.ts` | `/api/settings/billing` | GET |
| `src/app/api/settings/billing/change-plan/route.ts` | `/api/settings/billing/change-plan` | POST |
| `src/app/api/settings/billing/portal/route.ts` | `/api/settings/billing/portal` | POST |
| `src/app/api/settings/billing/invoices/route.ts` | `/api/settings/billing/invoices` | GET |

**Settings (1 route):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/settings/organization/route.ts` | `/api/settings/organization` | GET, PUT |

**User (1 route):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/user/notification-preferences/route.ts` | `/api/user/notification-preferences` | GET, PUT |

**Export (3 routes):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/settings/export/users/route.ts` | `/api/settings/export/users` | GET |
| `src/app/api/settings/export/tickets/route.ts` | `/api/settings/export/tickets` | GET |
| `src/app/api/settings/export/events/route.ts` | `/api/settings/export/events` | GET |

**Public (1 route):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/public/contact/route.ts` | `/api/public/contact` | POST |

**Auth (3 routes):**
| File | Route string | Methods |
|------|-------------|---------|
| `src/app/api/auth/me/route.ts` | `/api/auth/me` | GET |
| `src/app/api/auth/logout/route.ts` | `/api/auth/logout` | POST |
| `src/app/api/auth/resend-verification/route.ts` | `/api/auth/resend-verification` | POST |

**Total: 21 routes confirmed.**

### Anti-Patterns to Avoid

- **Changing business logic during instrumentation** — this is a mechanical retrofit. Zero changes to validation, response shapes, or Prisma queries.
- **Forgetting `log` placement** — `const log = logger.child(...)` must be BEFORE the `try` block so the catch block has access to it.
- **Logging PII** — no email, name, request bodies. Only: orgId, route, method, error object via `{ err: error }`.
- **Importing logger in middleware** — `src/middleware.ts` runs in Edge runtime. Pino requires Node.js worker_threads. Do not touch middleware.ts.
- **Skipping the backfill script** — modifying `permissions.ts` alone does not fix existing org admin users. The DB backfill is mandatory.
- **Using scope `null` or `''` instead of `'global'`** — the `Permission` table uses `'global'` as the scope sentinel for non-scoped permissions. The `@@unique` constraint is on `(resource, action, scope)`, so the wrong scope creates a duplicate row.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured error logging | Custom error formatter | `log.error({ err: error }, 'message')` | Pino's err serializer handles stack traces, circular refs, and error types correctly |
| Error reporting | Custom webhook/alert | `Sentry.captureException(error)` | Already installed and configured in Phase 13 |
| Permission DB assignment | Manual SQL or Prisma Studio | Backfill script following `backfill-new-roles.mjs` | Idempotent, auditable, re-runnable |
| Cache invalidation | Custom cache flush | `clearPermissionCache(userId)` from `@/lib/auth/permissions` | Already implemented; 30s TTL is acceptable for this change |

---

## Common Pitfalls

### Pitfall 1: Permission Scope Mismatch

**What goes wrong:** The `SETTINGS_BILLING` permission string is `'settings:billing'` — only two segments. When upserted into the `Permission` table, the scope must be `'global'` (the convention used throughout the codebase for non-scoped permissions). If the backfill script uses `scope: null` or `scope: ''`, the `@@unique([resource, action, scope])` constraint is violated or produces a duplicate row.

**Why it happens:** `parsePermission('settings:billing')` returns `scope: undefined`. But `organizationRegistrationService.ts` has its own `parsePermissionString` that defaults `scope` to `'global'` when the third segment is absent.

**How to avoid:** Use `scope: 'global'` explicitly in the backfill script. Verify by checking the actual Permission row for an existing permission like `settings:read` to confirm the scope value pattern.

**Verification:**
```bash
# Check scope value used for existing settings:read permission
node -e "
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.permission.findUnique({ where: { resource_action_scope: { resource: 'settings', action: 'read', scope: 'global' } } }).then(console.log).finally(() => p.\$disconnect())
"
```

### Pitfall 2: Pino log Outside Try Block

**What goes wrong:** If `const log = logger.child(...)` is declared inside the try block, the catch block cannot reference `log` and TypeScript throws a compile error (`Block-scoped variable 'log' used before declaration`).

**Why it happens:** Variable scoping — `const` inside `try` is not accessible in `catch`.

**How to avoid:** Always declare `const log = ...` before the `try` block. The existing instrumented routes in the codebase all follow this pattern — use `src/app/api/tickets/route.ts` as the exact reference.

### Pitfall 3: Billing Routes Use rawPrisma (Not orgScopedPrisma)

**What goes wrong:** The billing routes (`/api/settings/billing/*`) use `rawPrisma` directly because `Subscription` and `SubscriptionPlan` models are not in the org-scoped whitelist. Adding instrumentation must not change this — do not introduce `prisma` (org-scoped) imports.

**Why it happens:** Billing data is queried by `organizationId` in the `where` clause manually, not via the extension.

**How to avoid:** Only add `logger` and `Sentry` imports. Do not touch the Prisma import or query patterns.

### Pitfall 4: Auth Routes Lack orgId (Partial Sentry Context)

**What goes wrong:** `auth/me`, `auth/logout`, and `auth/resend-verification` may not have an `orgId` at the point where Sentry tags are set (they might fail before `getOrgIdFromRequest` is called, or orgId isn't relevant).

**Why it happens:** Auth routes are partially public or operate before org context is fully established.

**How to avoid:** Add `Sentry.captureException(error)` unconditionally in catch blocks. Only add `Sentry.setTag('org_id', orgId)` after successful extraction — wrap it in a try or add it only if orgId is available. The critical requirement is `Sentry.captureException` — the tag is supplementary.

### Pitfall 5: Permission Change Doesn't Auto-Apply to Existing Sessions

**What goes wrong:** An admin user logged in before the backfill runs. Their permission cache (30s TTL in-memory) holds the old role permissions. They still get 403 for up to 30 seconds after the backfill.

**Why it happens:** The permission cache (`permissionCache` Map in `src/lib/auth/permissions.ts`) is in-memory and TTL-based. It does not invalidate on DB changes.

**How to avoid:** This is acceptable behavior — 30s maximum delay is not a problem for a one-time migration. Document in the plan. If immediate validation is needed during testing, restart the dev server or wait 30 seconds after running the backfill.

---

## Code Examples

Verified patterns from existing codebase sources:

### Complete Instrumented Handler (Reference — tickets/route.ts)

```typescript
// Source: src/app/api/tickets/route.ts (Phase 13 instrumented route)
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/tickets', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    Sentry.setTag('org_id', orgId)

    return await runWithOrgContext(orgId, async () => {
      // ... business logic unchanged ...
    })
  } catch (error) {
    log.error({ err: error }, 'Failed to fetch tickets')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', '...'), { status: 500 })
  }
}
```

### Permission Backfill Script Structure

```javascript
// Source: scripts/backfill-new-roles.mjs (established pattern)
// scripts/backfill-billing-permission.mjs

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  // Step 1: Upsert permission row (global, shared)
  const perm = await prisma.permission.upsert({
    where: { resource_action_scope: { resource: 'settings', action: 'billing', scope: 'global' } },
    create: { resource: 'settings', action: 'billing', scope: 'global' },
    update: {},
    select: { id: true },
  })
  console.log(`Permission row id: ${perm.id}`)

  // Step 2: Find all admin roles across all orgs
  const adminRoles = await prisma.role.findMany({
    where: { slug: 'admin' },
    select: { id: true, organizationId: true },
  })
  console.log(`Found ${adminRoles.length} admin role(s)`)

  // Step 3: Assign permission to each admin role (idempotent)
  let added = 0, skipped = 0
  for (const role of adminRoles) {
    try {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: perm.id },
      })
      added++
    } catch (e) {
      if (e.code === 'P2002') { skipped++; continue } // unique constraint — already assigned
      throw e
    }
  }

  console.log(`Done: added=${added}, skipped=${skipped}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

### permissions.ts Change (Minimal Diff)

```typescript
// Source: src/lib/permissions.ts — ADMIN role, Settings section
// Add ONE line to the permissions array:
ADMIN: {
  permissions: [
    // ... existing permissions ...
    PERMISSIONS.SETTINGS_READ,
    PERMISSIONS.SETTINGS_UPDATE,
    PERMISSIONS.SETTINGS_BILLING,  // ADD THIS LINE — closes SET-02 audit gap
    // ... rest of permissions ...
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| 21 routes using `console.error` | `logger.child({ route, method })` + `Sentry.captureException` | Searchable logs + Sentry error tracking on 100% of API routes |
| Admin role missing `SETTINGS_BILLING` | Admin role includes `SETTINGS_BILLING` | Admin users can access billing tab without 403 |
| Billing fix requires new org signup | Backfill script updates existing orgs | All orgs fixed immediately |

---

## Open Questions

1. **Exact scope value in Permission table for 2-part permissions**
   - What we know: `parsePermissionString` in `organizationRegistrationService.ts` defaults scope to `'global'` for 2-part strings. Existing permissions like `settings:read` use this pattern.
   - What's unclear: Whether any edge case in the DB uses `null` or `''` instead of `'global'` for scope.
   - Recommendation: Query the actual DB for `settings:read` permission row to confirm scope = `'global'` before running backfill. This is a 2-minute check. Planner should add a verification step.

2. **Number of existing organizations to backfill**
   - What we know: The backfill script iterates all orgs. The script is idempotent (safe to re-run).
   - What's unclear: How many orgs currently exist in production.
   - Recommendation: Run `node scripts/list-orgs.mjs` (already in scripts/) before executing backfill. Not a blocker — script handles any count.

3. **public/contact route lacks orgId extraction**
   - What we know: `/api/public/contact` is a public endpoint (no auth). It has no `getOrgIdFromRequest` call.
   - What's unclear: Whether `Sentry.setTag('org_id', orgId)` should be omitted or if the route even has `orgId` context.
   - Recommendation: Skip `Sentry.setTag('org_id', ...)` for `public/contact`. Only add `log.error({ err: error }, 'message')` and `Sentry.captureException(error)`. This is correct behavior — public routes have no org context.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed in Phase 13) |
| Config file | `vitest.config.mts` (exists) |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-02 | Admin role includes `settings:billing` permission in DEFAULT_ROLES | unit | `npx vitest run __tests__/lib/permissions.test.ts` | Partial — file exists, needs new test case |
| SET-02 | Backfill script assigns permission to existing admin roles | smoke | `node scripts/backfill-billing-permission.mjs` (idempotent) | ❌ Wave 0 — script to create |
| INFRA-03 | All 21 routes import `logger` and use `log.error` in catch | automated check | `grep -rL "from '@/lib/logger'" [21 files] \| wc -l` (should be 0) | N/A — grep check |
| INFRA-04 | All 21 routes have `Sentry.captureException` in catch | automated check | `grep -rL "Sentry.captureException" [21 files] \| wc -l` (should be 0) | N/A — grep check |
| SET-02 | Admin user can GET /api/settings/billing (200 not 403) | smoke/manual | `npm run smoke:all` or manual API test with admin-role user | Existing smoke tests may cover |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green + manual billing API confirmation before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/backfill-billing-permission.mjs` — the DB backfill script (safe to run on remote)
- [ ] New test case in `__tests__/lib/permissions.test.ts` — verify `DEFAULT_ROLES.ADMIN.permissions` includes `PERMISSIONS.SETTINGS_BILLING`

None — existing test infrastructure covers the framework. Only the backfill script and one new test case are missing.

---

## Sources

### Primary (HIGH confidence)

- `src/app/api/tickets/route.ts` — canonical reference for the Phase 13 instrumentation pattern (child logger + Sentry tags + captureException)
- `src/lib/logger.ts` — existing Pino singleton (11 lines, confirmed pattern)
- `src/lib/permissions.ts` — `PERMISSIONS.SETTINGS_BILLING` defined at line 47; `DEFAULT_ROLES.ADMIN` confirmed missing `SETTINGS_BILLING` at lines 244-386
- `scripts/backfill-new-roles.mjs` — established pattern for per-org permission/role backfills
- `.planning/v2.0-MILESTONE-AUDIT.md` — authoritative list of 21 missing routes and the exact gap descriptions
- `src/lib/auth/permissions.ts` — confirmed 30s cache TTL; `clearPermissionCache` exists
- `src/lib/services/organizationRegistrationService.ts` — confirms scope defaults to `'global'` for 2-part permission strings
- `STATE.md` (Phase 13 decisions) — `Sentry.setTag('org_id')` placement after orgId extraction; FERPA logging discipline; child logger pattern per handler

### Secondary (MEDIUM confidence)

- Grep verification of all 21 route files — confirmed 0/21 have `from '@/lib/logger'` import (verified live)
- Confirmed `SETTINGS_BILLING` is enforced in all 4 billing routes via `assertCan(ctx.userId, PERMISSIONS.SETTINGS_BILLING)` — fix in `permissions.ts` is sufficient once the DB row is assigned

### Tertiary (LOW confidence)

- None — all findings are directly verifiable from the codebase.

---

## Metadata

**Confidence breakdown:**
- Permission fix (SET-02): HIGH — root cause precisely identified, fix location confirmed, backfill pattern established
- Instrumentation retrofit (INFRA-03/04): HIGH — all 21 routes enumerated and verified, pattern fully documented, zero new libraries needed
- Backfill script: HIGH — `backfill-new-roles.mjs` is an exact structural match; scope sentinel value needs one DB verification check

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable codebase patterns; no external API dependencies)

# Phase 18: Integration Gap Closure - Research

**Researched:** 2026-03-12
**Domain:** Notification preferences, AI route observability, middleware rate limiting
**Confidence:** HIGH

## Summary

Phase 18 is a surgical gap-closure phase with three independent, well-scoped fixes identified by the v2.0 milestone audit. No new features are added — only integration wiring that was missed when the original features were built.

**INT-01 (P1):** `createBulkNotifications` in `notificationService.ts` calls `prisma.notification.createMany` directly, skipping the `pauseAllNotifications` and `inAppEnabled` checks that `createNotification` (singular) correctly implements. The fix is to filter recipients through preference lookups before the `createMany` call. This closes the "Inventory Checkout → Low-Stock → Preference Check → Delivery" E2E flow, which breaks at `notifyLowStock` in `inventoryService.ts` line 165.

**INT-02 (P2):** Three AI routes (`/api/ai/assistant/chat`, `/api/ai/generate-description`, `/api/ai/parse-event`) were created before Phase 13's observability sweep and were missed by Phase 16's retrofit. They use bare `console.error` calls. The fix is a one-line import of `logger` and `Sentry`, plus replacing `console.error` with `log.error` + `Sentry.captureException(error)`. The chat route also has `safeAsync` helpers that use `console.error` internally.

**INT-03 (P3):** `POST /api/auth/resend-verification` is listed in `isPublicPath()` but absent from the `publicApiRateLimiter` branch in middleware. It already has an application-level 3/hour DB token check, but the middleware layer is missing for consistency. The fix is adding one condition to the existing `else if` chain in middleware.

**Primary recommendation:** Implement all three fixes in a single plan. The changes are small and co-located. All three success criteria are fully verifiable with Vitest tests.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INV-04 | Admin can view full transaction history for any inventory item | Transactions route exists and is complete; gap is the bulk notification bypass that breaks the full checkout→alert flow |
| SET-05 | Users can configure which email/in-app notifications they receive | NotificationPreference model and createNotification (singular) correctly honors prefs; createBulkNotifications bypasses them — fix closes the preference enforcement gap |
| INFRA-03 | Structured JSON logging (Pino) with log levels | logger.child pattern established in Phase 13, retrofitted in Phase 16; 3 AI routes missed — fix adds identical instrumentation |
| INFRA-04 | Runtime errors reported to Sentry with context | Sentry.captureException established pattern; same 3 AI routes missing — fix adds identical Sentry calls |
| AUTH-03 | All public endpoints enforce rate limiting | publicApiRateLimiter branch in middleware is the established pattern; resend-verification missing from that branch — one-line fix in middleware |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pino` | Installed (Phase 13) | Structured JSON logger | Project-standard via `src/lib/logger.ts` singleton |
| `@sentry/nextjs` | Installed (Phase 13) | Error capture + context | Project-standard; `Sentry.captureException` pattern established |
| `vitest` | Installed (Phase 13) | Unit tests | Project-standard; config in `vitest.config.mts` |
| `vitest-mock-extended` | Installed (Phase 13) | Deep Prisma mocks | Used in all existing `__tests__/` files |

**No new packages needed for Phase 18.**

---

## Architecture Patterns

### Pattern 1: Pino + Sentry Route Instrumentation (Established — Phase 13/16)

This is the exact pattern used across all Phase 16 retrofitted routes. Apply identically to the 3 AI routes.

```typescript
// Source: src/app/api/inventory/route.ts (Phase 16 pattern)
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/ai/generate-description', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    // ... route logic ...
  } catch (error) {
    // ... permission/auth error handling ...
    log.error({ err: error }, 'Failed to generate description')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', '...'), { status: 500 })
  }
}
```

**Special case for the chat route:** The outer catch block at line 598-615 of `chat/route.ts` is the right place for `log.error` + `Sentry.captureException`. The inner stream catch (line 579-587) should also replace `console.error` with `log.error`. The `safeAsync` helper at line 75-79 uses `console.error` — replace with `log.error`. `Sentry.setTag('org_id', orgId)` goes immediately after `orgId` is extracted (line 111).

**Note on chat route:** There is NO `getOrgIdFromRequest` call before the Gemini key check — the orgId/ctx are fetched at lines 111-112 before any early return for missing API key. This means `Sentry.setTag` should go on line 113 (after orgId and ctx are established).

### Pattern 2: Bulk Notification Preference Filter (New — closes INT-01)

The fix mirrors how `createNotification` (singular) works, but batches the preference lookup:

```typescript
// Current (broken): calls createMany directly without preference check
export async function createBulkNotifications(items: CreateBulkNotificationInput[]) {
  if (items.length === 0) return
  try {
    await prisma.notification.createMany({ data: items.map(...) as any })
  } catch (err) {
    console.error('Failed to create bulk notifications:', err)
  }
}

// Fixed: filter recipients through preferences first
export async function createBulkNotifications(items: CreateBulkNotificationInput[]) {
  if (items.length === 0) return
  try {
    // 1. Collect unique userIds
    const userIds = [...new Set(items.map(i => i.userId))]

    // 2. Batch-fetch pauseAllNotifications for all users
    const users = await rawPrisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, pauseAllNotifications: true },
    })
    const pausedSet = new Set(
      users.filter(u => u.pauseAllNotifications).map(u => u.id)
    )

    // 3. Batch-fetch per-type inAppEnabled preferences
    // Only need to fetch rows where inAppEnabled = false (disabled prefs)
    // Absent row = default enabled, so we only filter on explicit disables
    const disabledPrefs = await rawPrisma.notificationPreference.findMany({
      where: {
        userId: { in: userIds },
        type: { in: [...new Set(items.map(i => i.type))] },
        inAppEnabled: false,
      },
      select: { userId: true, type: true },
    })
    const disabledSet = new Set(
      disabledPrefs.map(p => `${p.userId}:${p.type}`)
    )

    // 4. Filter items to only eligible recipients
    const eligible = items.filter(item => {
      if (pausedSet.has(item.userId)) return false
      if (disabledSet.has(`${item.userId}:${item.type}`)) return false
      return true
    })

    if (eligible.length === 0) return

    await prisma.notification.createMany({
      data: eligible.map((item) => ({
        userId: item.userId,
        type: item.type,
        title: item.title,
        body: item.body ?? null,
        linkUrl: item.linkUrl ?? null,
      })) as any,
    })
  } catch (err) {
    console.error('Failed to create bulk notifications:', err)
  }
}
```

**Performance note:** This approach uses 2 batch queries (one for users, one for preferences) instead of N individual queries. With typical inventory-alert recipient counts (< 50 admins), this is safe and efficient. The `rawPrisma` calls are correct here — `NotificationPreference` is NOT in the org-scoped whitelist (confirmed in STATE.md: "NotificationPreference queries use rawPrisma — model not in org-scoped whitelist in db/index.ts").

### Pattern 3: Middleware Rate Limiter Extension (Closes INT-03)

The existing `publicApiRateLimiter` branch in `middleware.ts` (lines 163-169) is a simple `else if` chain:

```typescript
// Current (missing resend-verification):
} else if (
  pathname.startsWith('/api/auth/forgot-password') ||
  pathname.startsWith('/api/auth/set-password') ||
  pathname.startsWith('/api/auth/reset-password')
) {
  limiter = publicApiRateLimiter
}

// Fixed (add resend-verification):
} else if (
  pathname.startsWith('/api/auth/forgot-password') ||
  pathname.startsWith('/api/auth/set-password') ||
  pathname.startsWith('/api/auth/reset-password') ||
  pathname.startsWith('/api/auth/resend-verification')
) {
  limiter = publicApiRateLimiter
}
```

This is a 1-line diff. The `resend-verification` route already has Pino + Sentry (added in Phase 16), and already has an app-level 3/hour DB check. The middleware rate limit (30 req/min) adds a coarser IP-level guard before any DB work is done.

---

## File Inventory

### Files That Need Changes

| File | Change | Gap |
|------|--------|-----|
| `src/lib/services/notificationService.ts` | Replace `createBulkNotifications` body with preference-filtered version | INT-01 |
| `src/app/api/ai/generate-description/route.ts` | Add `logger.child`, `Sentry.setTag`, `Sentry.captureException`, replace `console.error` | INT-02 |
| `src/app/api/ai/parse-event/route.ts` | Add `logger.child`, `Sentry.setTag`, `Sentry.captureException`, replace `console.error` | INT-02 |
| `src/app/api/ai/assistant/chat/route.ts` | Add `logger.child`, `Sentry.setTag`, `Sentry.captureException`, replace all `console.error` calls | INT-02 |
| `src/middleware.ts` | Add `resend-verification` to `publicApiRateLimiter` branch | INT-03 |

### Files That Should Gain Tests

| File | Test Target | Test Type |
|------|------------|-----------|
| `__tests__/lib/notificationService.test.ts` | `createBulkNotifications` respects `pauseAllNotifications` and `inAppEnabled: false` | Unit |
| `__tests__/api/ai-routes.test.ts` | `generate-description` and `parse-event` return 500 on Gemini failure, Sentry called | Unit |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batch preference query | Custom caching layer | Simple `rawPrisma.findMany` | Query is fast; recipients are typically < 50 |
| Rate limit storage | Redis or new store | Existing `publicApiRateLimiter` | Already configured with correct limits |
| Sentry context | Custom error reporter | `Sentry.captureException` + `Sentry.setTag` | Already installed; identical to all other routes |
| Logger | New logger instance | Import from `@/lib/logger` singleton | Singleton guarantees consistent config |

---

## Common Pitfalls

### Pitfall 1: chat/route.ts — SSE Stream Catch vs Outer Catch

**What goes wrong:** The chat route has TWO catch blocks:
1. Outer catch (lines 598-615) — catches sync errors before the stream starts
2. Inner stream catch (lines 579-587) — catches async errors inside the ReadableStream callback

Both need instrumentation. `Sentry.setTag('org_id', orgId)` only belongs in the outer try block (where `orgId` is extracted). The inner stream already has access to `orgId` via closure but `Sentry.setTag` was already called at that point.

**How to avoid:** Add `log.error` + `Sentry.captureException` to the inner stream catch (line 580). Add `log.error` + `Sentry.captureException` to the outer catch (line 611). Add `Sentry.setTag('org_id', orgId)` after line 111 (`const orgId = getOrgIdFromRequest(req)`).

**Warning signs:** If only the outer catch is instrumented, streaming errors won't appear in Sentry.

### Pitfall 2: chat/route.ts — safeAsync console.error

**What goes wrong:** `safeAsync` at line 75 uses `console.error` internally. These are fire-and-forget background operations (persist messages, memory extraction). The `log` variable is scoped inside the `POST` handler, so `safeAsync` can't use it directly.

**How to avoid:** Import `logger` at module level and use `logger.child({ route, method })` inside `safeAsync`'s catch — or pass the child logger in as a closure. The simplest fix is moving the `logger.child` call to module scope (or passing it to `safeAsync`). Example:

```typescript
// Move log to outer scope in the route module:
const routeLog = logger.child({ route: '/api/ai/assistant/chat', method: 'POST' })

function safeAsync(fn: () => Promise<unknown>, label: string): void {
  fn().catch((err) => {
    routeLog.error({ err, label }, 'Background task failed')
  })
}
```

### Pitfall 3: generate-description / parse-event — No getOrgIdFromRequest

**What goes wrong:** These two lightweight routes do NOT call `getOrgIdFromRequest` — they only call `getUserContext`. There is no `orgId` available for `Sentry.setTag('org_id', orgId)`.

**How to avoid:** Either skip `Sentry.setTag` in these routes (acceptable — they're thin wrappers without multi-tenant context), or add `getOrgIdFromRequest(req)` before the try-catch if the route needs org scoping. Since these routes already work without orgId, **skip `Sentry.setTag` here** — just add `logger.child` and `Sentry.captureException`. The audit only requires Pino instrumentation and Sentry error capture, not necessarily setTag.

### Pitfall 4: createBulkNotifications — rawPrisma for NotificationPreference

**What goes wrong:** Using `prisma` (org-scoped) instead of `rawPrisma` for `NotificationPreference` queries will fail because `NotificationPreference` is not in the org-scoped whitelist in `db/index.ts`.

**How to avoid:** Use `rawPrisma` for both the `user` lookup and the `notificationPreference` lookup in `createBulkNotifications`, exactly as `createNotification` (singular) does. This is confirmed in STATE.md: "NotificationPreference queries use rawPrisma — model not in org-scoped whitelist in db/index.ts".

### Pitfall 5: Middleware Rate Limit — isPublicPath ordering

**What goes wrong:** Thinking that `isPublicPath` and the rate limiter branch are mutually exclusive. In the current middleware, the rate limiter block (lines 153-181) runs BEFORE `isPublicPath` is checked. The pattern is intentional — rate limiting applies to all `/api/` paths, then public paths bypass auth below. Adding `resend-verification` to the rate limiter branch does NOT remove it from `isPublicPath` — both continue to exist.

**How to avoid:** Only add the single `pathname.startsWith('/api/auth/resend-verification')` condition to the rate limiter branch. Do NOT touch `isPublicPath`.

---

## Code Examples

### Verified: Current notificationService.ts Pattern (createNotification singular)

```typescript
// Source: src/lib/services/notificationService.ts:84-116
export async function createNotification(data: CreateNotificationInput) {
  try {
    const [user, pref] = await Promise.all([
      rawPrisma.user.findUnique({
        where: { id: data.userId },
        select: { pauseAllNotifications: true },
      }),
      rawPrisma.notificationPreference.findUnique({
        where: { userId_type: { userId: data.userId, type: data.type } },
        select: { inAppEnabled: true },
      }),
    ])
    if (user?.pauseAllNotifications) return
    if (pref && !pref.inAppEnabled) return
    await prisma.notification.create({ data: { ... } as any })
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}
```

The bulk fix must replicate this same logic but batched.

### Verified: Phase 16 Observability Retrofit Pattern

```typescript
// Source: src/app/api/inventory/route.ts
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/inventory', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    // ... logic ...
  } catch (error) {
    log.error({ err: error }, 'Failed to list inventory items')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', '...'), { status: 500 })
  }
}
```

### Verified: Middleware Rate Limiter Branch

```typescript
// Source: src/middleware.ts:161-169
if (pathname === '/api/organizations/signup') {
  limiter = signupRateLimiter
} else if (
  pathname.startsWith('/api/auth/forgot-password') ||
  pathname.startsWith('/api/auth/set-password') ||
  pathname.startsWith('/api/auth/reset-password')
) {
  limiter = publicApiRateLimiter
}
// ADD: || pathname.startsWith('/api/auth/resend-verification')
```

### Verified: Vitest Mock Pattern (from existing __tests__)

```typescript
// Source: __tests__/api/tickets.test.ts
vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  return { rawPrisma: mock, prisma: mock }
})

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
  runWithOrgContext: vi.fn().mockImplementation((_orgId, fn) => fn()),
}))
```

---

## State of the Art

| Area | Current State | This Phase Changes |
|------|--------------|-------------------|
| `createNotification` (singular) | Correctly checks preferences | No change |
| `createBulkNotifications` | Bypasses preferences — broken | Fixed to batch-check preferences |
| AI routes observability | 3 of N routes uninstrumented | All 3 receive identical Pino+Sentry pattern |
| resend-verification rate limit | App-level only (DB check) | Adds middleware IP-level coarse guard |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.mts) |
| Config file | `vitest.config.mts` |
| Quick run command | `npx vitest run __tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-05 / INV-04 | `createBulkNotifications` skips users with `pauseAllNotifications=true` | Unit | `npx vitest run __tests__/lib/notificationService.test.ts` | Wave 0 |
| SET-05 / INV-04 | `createBulkNotifications` skips users with `inAppEnabled=false` for given type | Unit | `npx vitest run __tests__/lib/notificationService.test.ts` | Wave 0 |
| SET-05 / INV-04 | `createBulkNotifications` still delivers to users with preferences enabled | Unit | `npx vitest run __tests__/lib/notificationService.test.ts` | Wave 0 |
| INFRA-03 / INFRA-04 | `generate-description` route calls `log.error` and `Sentry.captureException` on failure | Unit | `npx vitest run __tests__/api/ai-routes.test.ts` | Wave 0 |
| INFRA-03 / INFRA-04 | `parse-event` route calls `log.error` and `Sentry.captureException` on failure | Unit | `npx vitest run __tests__/api/ai-routes.test.ts` | Wave 0 |
| AUTH-03 | Middleware applies `publicApiRateLimiter` to `resend-verification` | Manual smoke / code review | Code review of middleware.ts | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run __tests__/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `__tests__/lib/notificationService.test.ts` — covers SET-05/INV-04 bulk preference filtering
- [ ] `__tests__/api/ai-routes.test.ts` — covers INFRA-03/INFRA-04 for generate-description and parse-event
- [ ] `__tests__/api/chat-route.test.ts` — covers INFRA-03/INFRA-04 for chat route (optional, complex due to SSE streaming)

---

## Open Questions

1. **chat/route.ts test complexity**
   - What we know: The chat route uses SSE streaming (`ReadableStream`), making it harder to unit-test than the other two AI routes
   - What's unclear: Whether to write a full chat route test or rely on code review + the existing smoke test infrastructure
   - Recommendation: Write tests only for `generate-description` and `parse-event` (simpler request/response pattern). The chat route's `safeAsync` instrumentation is reviewable via code inspection. The audit only requires the instrumentation be added — not that it be unit-tested.

2. **createBulkNotifications performance under load**
   - What we know: The fix adds 2 batch DB queries (users + preferences) before `createMany`
   - What's unclear: Whether this matters for very large orgs with many admins
   - Recommendation: Acceptable for Phase 18. If recipient count > 100, the batch queries still complete in < 10ms on Supabase. Redis caching is deferred to v2.1 per existing architecture decisions.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/lib/services/notificationService.ts` — current implementation confirmed
- Direct code inspection: `src/middleware.ts` — rate limiter branch confirmed, gap confirmed
- Direct code inspection: `src/app/api/ai/*/route.ts` — console.error calls confirmed, no logger/Sentry imports
- Direct code inspection: `src/lib/logger.ts` — Pino singleton confirmed
- Direct code inspection: `src/app/api/inventory/route.ts` — Phase 16 instrumentation pattern confirmed
- `.planning/v2.0-MILESTONE-AUDIT.md` — INT-01, INT-02, INT-03 evidence confirmed

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — Architecture decisions for rawPrisma/org-scoping of NotificationPreference
- `prisma/schema.prisma:3521-3534` — NotificationPreference model with `@@unique([userId, type])` confirmed
- `__tests__/api/tickets.test.ts` — Vitest mock pattern confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, confirmed via file inspection
- Architecture: HIGH — patterns directly read from existing production code in repo
- Pitfalls: HIGH — identified from direct code reading, not speculation

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain — no external dependencies changing)

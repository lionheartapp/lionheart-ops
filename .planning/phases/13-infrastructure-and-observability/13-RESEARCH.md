# Phase 13: Infrastructure and Observability - Research

**Researched:** 2026-03-11
**Domain:** CI/CD, Structured Logging, Error Tracking, Testing, Pagination, Database Transactions
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Test runner:** Vitest (already decided in PROJECT.md)
- **Test coverage priority:** auth & permissions → multi-tenancy layer → core CRUD routes (tickets, events, calendar, inventory)
- **Testing depth:** unit tests + light integration tests
- **Integration tests:** use a local Docker Postgres container in CI (not Supabase dev DB)
- **Smoke tests:** existing `scripts/smoke-*.mjs` stay separate — not migrated into Vitest
- **Pagination style:** offset-based (`?page=2&limit=25`) using Prisma `skip`/`take`
- **Pagination defaults:** page size = 25 items; responses include `totalCount` and `totalPages`
- **Pagination priority:** retrofit high-volume endpoints first: tickets, events, users, audit logs, inventory, calendar-events
- **Error tracking:** Sentry (confirmed over Vercel-only monitoring)
- **Sentry notifications:** email digest (not real-time per-error alerts)
- **Sentry context:** org ID, route, user role — no PII (no emails, names)
- **Performance monitoring:** enabled (trace slow API routes and page loads)
- **Sentry + Vercel:** run alongside each other
- **Structured logging:** Pino replaces all `console.error/warn/log` in route handlers
- **Log fields:** org ID, route, response timing — no user-level PII
- **Log destination:** Vercel's built-in log drain (stdout, captured automatically)
- **Log levels:** `info` in production, `debug` in development
- **Never log:** request/response bodies (FERPA-adjacent data sensitivity)
- **Error context:** use Sentry (not logs) for detailed error context and stack traces

### Claude's Discretion
- Vitest configuration details (setup files, module mocking strategy, coverage thresholds)
- Pino logger initialization pattern (singleton, per-request, middleware)
- Sentry SDK configuration (sample rates, ignored errors, environment tagging)
- Which specific routes qualify as "high-volume" for pagination priority
- Transaction wrapping strategy for existing sequential-await patterns
- CI pipeline step ordering and caching strategy
- Test file organization (`__tests__/` vs co-located `.test.ts`)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Critical API routes have Vitest unit tests covering happy path and error cases | Vitest + vitest-mock-extended singleton pattern; test auth/permissions/org-context modules, ticketService, eventService |
| INFRA-02 | GitHub Actions CI pipeline runs tests, linting, and type-check on every PR | Extend existing `.github/workflows/ci.yml` with `vitest run`, `next lint`, `tsc --noEmit`; add caching for node_modules |
| INFRA-03 | Application uses structured JSON logging (Pino) with log levels instead of console.error | Pino singleton at `src/lib/logger.ts`; replace 364+ `console.*` calls across 31 API route files and lib/services |
| INFRA-04 | Runtime errors are captured and reported to Sentry with context | `@sentry/nextjs` v8.28.0+ via wizard; `instrumentation.ts` with `onRequestError`; `Sentry.setTag` for orgId/route |
| INFRA-05 | All list API endpoints support offset pagination with configurable page size | Shared `parsePagination()` utility; tickets/events/users/inventory/calendar-events/audit-logs upgraded; `ok(data, { total, page, limit, totalPages })` envelope |
| INFRA-06 | Complex multi-model operations use database transactions instead of sequential awaits | `rawPrisma.$transaction(async (tx) => { ... })` pattern; 11 files already use this — identify 5-10 routes with sequential mutating awaits that lack wrapping |
</phase_requirements>

---

## Summary

Phase 13 hardens the platform's operational foundation across six distinct concerns: testing, CI, logging, error tracking, pagination, and data integrity. Each concern maps to a concrete library or pattern already common in the Next.js ecosystem and largely verified against official sources.

The codebase enters this phase in a partially-ready state. The CI pipeline exists but only runs a build. Pagination exists on some routes (tickets, events, audit-logs) with inconsistent query parameter names (`limit`/`offset` vs `page`/`limit`). Eleven files already use Prisma transactions. Zero files use Pino or Sentry. There are 364+ `console.*` calls in API route files and lib/services that need replacement.

The primary risk is scope creep on the Pino migration — 31+ API files need `console.error` replaced, and doing so naively creates hundreds of small changes. The recommended approach is a shared logger singleton that any file can import, combined with a `withLogger` route wrapper that binds org/route context to every log call. This reduces per-file change surface significantly.

**Primary recommendation:** Build four shared utilities first (Pino logger singleton, pagination helper, Sentry instrumentation files, Vitest+Prisma mock setup), then retrofit existing routes using those utilities — rather than touching each file independently.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^2.x | Test runner | Official Next.js recommendation; Vite-native; fast |
| @vitejs/plugin-react | ^4.x | JSX transform in tests | Required for React component tests in Vitest |
| vite-tsconfig-paths | ^5.x | `@/` alias resolution in tests | Resolves the same aliases `tsconfig.json` defines |
| vitest-mock-extended | ^2.x | Deep-mocks for Prisma client | Type-safe mocking without a real DB connection |
| @testing-library/react | ^16.x | Component render/query utilities | Standard companion to Vitest for React |
| pino | ^9.x | Structured JSON logging | Fastest Node.js logger; stdout JSON for Vercel drain |
| pino-pretty | ^13.x | Dev-only colorized output | Never runs in production; dev DX only |
| @sentry/nextjs | ^8.28.0+ | Error tracking + performance | Official Sentry SDK for Next.js; App Router support |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @testing-library/dom | ^10.x | DOM query utilities (RTL dependency) | Bundled with @testing-library/react |
| jsdom | ^25.x | DOM environment for Vitest | Required for any component render tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-mock-extended | prismock | prismock runs in-memory DB simulation — more realistic but slower; singleton mock is sufficient for unit tests |
| pino | winston / bunyan | Pino is 5x faster; better stdout JSON discipline for cloud environments |
| @sentry/nextjs | Vercel monitoring only | Sentry provides stack traces, release tracking, custom context — Vercel logs alone lack these |

**Installation:**
```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths vitest-mock-extended @testing-library/react @testing-library/dom jsdom
npm install pino pino-pretty
npm install @sentry/nextjs
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── logger.ts              # Pino singleton — import this everywhere
│   └── pagination.ts          # parsePagination() + PaginatedResponse type
├── app/
│   └── api/
│       └── [route]/route.ts   # Replace console.* with logger.*, add pagination helper
├── instrumentation.ts         # Sentry server + edge init (Next.js standard location)
├── instrumentation-client.ts  # Sentry browser init
├── sentry.server.config.ts    # Sentry DSN + options (server)
├── sentry.edge.config.ts      # Sentry DSN + options (edge)
└── app/global-error.tsx       # Sentry React error boundary
__tests__/
├── lib/
│   ├── auth.test.ts
│   ├── permissions.test.ts
│   └── org-context.test.ts
└── api/
    ├── tickets.test.ts
    ├── events.test.ts
    └── users.test.ts
vitest.config.mts              # Vitest config in root
```

### Pattern 1: Pino Logger Singleton

**What:** A single exported logger instance with environment-aware config. Child loggers bind request-level context.
**When to use:** Import `logger` from `@/lib/logger` in every API route and service file. Create a child logger per-request with `{ orgId, route }`.

```typescript
// Source: https://blog.arcjet.com/structured-logging-in-json-for-next-js/
// src/lib/logger.ts
import pino from 'pino'

export const logger = process.env.NODE_ENV === 'production'
  ? pino({ level: 'info' })
  : pino({
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
      level: 'debug',
    })

// Usage in route handlers:
// const log = logger.child({ orgId, route: '/api/tickets' })
// log.info({ ticketId }, 'Ticket created')
// log.error({ err }, 'Failed to create ticket')
```

**next.config.ts change:** `pino` is in Next.js's default `serverExternalPackages` list as of Next.js 15 — no explicit configuration needed. Verify if `pino-pretty` needs adding alongside `mjml` in the existing `serverExternalPackages` array.

```typescript
// src/lib/logger.ts — FERPA-safe discipline
// NEVER log: req.body, user email, user name, student data
// ALWAYS log: orgId, route, method, status, duration (timing)
// Use Sentry (not logger) for error stack traces
```

### Pattern 2: Pagination Helper

**What:** Shared utility that parses `?page=&limit=` query params and returns Prisma `skip`/`take` values + metadata.
**When to use:** Every list endpoint that needs pagination.

The audit-logs route (`src/app/api/settings/audit-logs/route.ts`) is the **reference implementation** — it already uses `?page=&limit=` with `ok(data, { total, page, limit, totalPages })`. Standardize all other routes to match this pattern exactly.

```typescript
// Source: pattern derived from audit-logs/route.ts
// src/lib/pagination.ts
export interface PaginationParams {
  page: number
  limit: number
  skip: number
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 25,
  maxLimit = 100
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(maxLimit, Math.max(1, parseInt(searchParams.get('limit') ?? String(defaultLimit), 10)))
  return { page, limit, skip: (page - 1) * limit }
}

export function paginationMeta(total: number, params: PaginationParams): PaginationMeta {
  return {
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.ceil(total / params.limit),
  }
}
```

**IMPORTANT: Parameter naming alignment.** Current tickets and events routes use `limit` + `offset` (non-standard for this pattern). The CONTEXT.md decision is `?page=2&limit=25`. The migration changes the tickets/events route query params from `offset` to `page` — this is a **breaking change for any client code** reading those params. Clients currently using `?limit=50&offset=0` must be updated to `?page=1&limit=25`.

### Pattern 3: Vitest + Prisma Mock Singleton

**What:** Deep-mock the Prisma client using `vitest-mock-extended`. Mock resets before each test.
**When to use:** All unit tests touching service functions or route handlers that call Prisma.

```typescript
// Source: https://github.com/prisma/prisma/discussions/20244
// src/lib/__mocks__/db.ts
import { PrismaClient } from '@prisma/client'
import { beforeEach } from 'vitest'
import { mockReset, mockDeep } from 'vitest-mock-extended'

export const prisma = mockDeep<PrismaClient>()
export const rawPrisma = mockDeep<PrismaClient>()

beforeEach(() => {
  mockReset(prisma)
  mockReset(rawPrisma)
})
```

```typescript
// vitest.config.mts
// Source: https://nextjs.org/docs/app/guides/testing/vitest
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'node',  // node env for API route/service testing
    globals: true,
  },
})
```

**Note on environment:** Use `node` (not `jsdom`) for service and route handler tests. Use `jsdom` for React component tests. Can set per-file with `// @vitest-environment jsdom` if needed.

**Mocking the org-scoped prisma:** The project exports `prisma` from `@/lib/db`. `vi.mock('@/lib/db', () => ({ prisma: prismaMock, rawPrisma: rawPrismaMock }))` intercepts the import. Because `runWithOrgContext` uses `AsyncLocalStorage`, you must call it in tests to provide org context to service functions, or mock it directly.

### Pattern 4: Sentry Integration

**What:** `@sentry/nextjs` wraps Next.js with error capture. `instrumentation.ts` registers the SDK. Custom tags attach org context without PII.
**When to use:** Replaces `console.error` for error reporting. Complements (not replaces) Pino for structured logs.

```typescript
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  // PII policy: never sendDefaultPii — this is a K-12 platform
  sendDefaultPii: false,
  integrations: [
    Sentry.pinoIntegration({ log: { levels: ['warn', 'error'] } }),
  ],
})
```

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
// Required for Next.js 15 App Router error capture:
export { onRequestError } from '@sentry/nextjs'
```

**Adding org context to Sentry events (no PII):**
```typescript
// In route handlers, after getUserContext():
Sentry.setTag('org_id', orgId)
Sentry.setTag('user_role', ctx.roleName)
// DO NOT set user email, name, or student-related data
```

### Pattern 5: GitHub Actions CI Extension

**What:** Add Vitest, ESLint, and TypeScript type-check steps to the existing `ci.yml`.
**When to use:** Runs on every PR and push to main.

```yaml
# Extending .github/workflows/ci.yml
# Add after "Install dependencies" step:

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

      - name: Test
        run: npx vitest run
        env:
          AUTH_SECRET: test-secret-min-32-chars-for-jose-hs256
```

**CI ordering recommendation:** Install → Prisma generate → Type-check → Lint → Test → Build
This ordering catches compile errors before running tests, and runs faster checks before slower ones.

**Note:** `eslint.ignoreDuringBuilds: true` is set in `next.config.ts` — this means `npm run build` skips ESLint. The CI must run `npm run lint` as an explicit step for it to block PRs.

### Pattern 6: Prisma Transaction Wrapping

**What:** Wrap sequential multi-model writes in `rawPrisma.$transaction()`. The `tx` client is passed to all writes inside.
**When to use:** Any route or service that performs multiple writes where a failure in step N should roll back steps 1..N-1.

```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
// Pattern from existing $transaction users (e.g. settings/roles/[id]/route.ts)
await rawPrisma.$transaction(async (tx) => {
  const role = await tx.role.create({ data: roleData })
  await tx.rolePermission.createMany({
    data: permissions.map(p => ({ roleId: role.id, permissionId: p.id }))
  })
  return role
})
```

**CAUTION with org-scoped client:** The CLAUDE.md warns: "`$transaction` with org-scoped client can behave unexpectedly. Use `rawPrisma.$transaction([...])` for batch operations." Use `rawPrisma.$transaction()` for all transaction wrapping, not the org-scoped `prisma.$transaction()`.

### Anti-Patterns to Avoid

- **console.error in catch blocks**: Replace with `logger.error({ err: error }, 'message')` — Pino serializes error objects correctly.
- **Logging request/response bodies**: Violates FERPA-adjacent data discipline. Log only IDs and timing.
- **Sentry `sendDefaultPii: true`**: Do not enable. This is a K-12 platform — auto-capturing headers, IPs, and user data is inappropriate.
- **Pagination without totalCount**: Always return `total` and `totalPages` so clients can render "Page X of Y" without an extra request.
- **Separate transaction clients for each write**: All writes in a transaction must use the `tx` parameter — mixing `tx` and `rawPrisma` inside a transaction body breaks atomicity.
- **jsdom environment for route handler tests**: API route handlers are server-side Node.js code. Use `environment: 'node'` or vitest will fail to find Node APIs like `AsyncLocalStorage`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pino transport config | Custom JSON formatter | `pino` + `pino-pretty` | Pino handles JSON serialization, pretty-print, level filtering, child loggers |
| Sentry event capture | Custom error webhook | `@sentry/nextjs` | SDK handles source maps, release tracking, performance tracing, sampling |
| Prisma deep mocking | Manual stub objects | `vitest-mock-extended` | Type-safe: TS compiler catches wrong mock shapes; auto-resets per test |
| Pagination parsing | Per-route `parseInt` calls | `parsePagination()` utility | Eliminates 19+ duplicated parse blocks; single place to enforce min/max |
| CI workflow | Custom scripts | GitHub Actions standard steps | `actions/setup-node@v4` with `cache: npm` is the established pattern |

**Key insight:** The pagination and logging changes have the highest cross-cutting surface (30+ files). Building a single utility for each eliminates copy-paste drift and makes future changes a one-line update.

---

## Common Pitfalls

### Pitfall 1: Pino in Edge Runtime

**What goes wrong:** Pino uses Node.js `worker_threads` internally. If any file that imports `@/lib/logger` is used in an Edge runtime route, the build fails.
**Why it happens:** Next.js Edge runtime is not Node.js — it's a subset that excludes `worker_threads`.
**How to avoid:** The Pino singleton is only imported from server-side route handlers (`runtime: 'nodejs'`). Middleware (`src/middleware.ts`) runs in Edge — do not import Pino there.
**Warning signs:** Build error: "Module worker_threads is not available in the edge runtime."

### Pitfall 2: `console.*` Calls in lib/services

**What goes wrong:** The 364 `console.*` instances aren't all in `src/app/api/` — many are in `src/lib/services/`. Services are imported by route handlers but the console calls still fire in production.
**Why it happens:** The migration scope is broader than "route files only."
**How to avoid:** Run the migration against `src/app/api/**/*.ts` AND `src/lib/services/**/*.ts`. The CONTEXT.md says "68 calls across 30 files" for route handlers, but actual count is higher (364 in API, 146 in lib). Migrate route handlers first (highest value), services second.
**Warning signs:** Grep for `console\.` after migration to verify zero remaining calls.

### Pitfall 3: Breaking Existing Clients with Pagination Param Rename

**What goes wrong:** Current tickets and events routes accept `?limit=50&offset=0`. The new standard is `?page=1&limit=25`. Any UI component or smoke test using the old params silently gets wrong results (offset param ignored, page defaults to 1).
**Why it happens:** The CONTEXT.md decision uses `page` not `offset` — this is a rename, not just a default change.
**How to avoid:** Search for `limit=` and `offset=` in `src/components/` and `scripts/smoke-*.mjs`. Update all call sites when the route changes. The smoke tests are NOT migrated to Vitest but must continue to work.
**Warning signs:** Smoke test returning fewer results than expected after pagination retrofit.

### Pitfall 4: Sentry `onRequestError` Requires Next.js 15

**What goes wrong:** The `onRequestError` export from `instrumentation.ts` (which captures Server Component and route handler errors) only works with `@sentry/nextjs >= 8.28.0` AND `next >= 15.0.0`.
**Why it happens:** This hook was added specifically for Next.js 15's new request lifecycle.
**How to avoid:** Verify package versions: `npm list next @sentry/nextjs`. Current project uses `next: ^15.1.0` — compatible. Install `@sentry/nextjs@^8.28.0` or later.
**Warning signs:** Route handler errors not appearing in Sentry dashboard despite setup.

### Pitfall 5: Vitest Can't Test Async Server Components

**What goes wrong:** Attempting to test React Server Components that are `async` functions fails in Vitest.
**Why it happens:** The React testing ecosystem (Testing Library) doesn't yet support async RSC rendering.
**How to avoid:** Unit tests target: service functions, auth/permission utilities, and pure helper functions. Route handlers can be tested by calling them directly as async functions with mock `NextRequest` objects — not by rendering them as components.
**Warning signs:** `Error: Objects are not valid as a React child` or component test hanging.

### Pitfall 6: `rawPrisma.$transaction` vs `prisma.$transaction`

**What goes wrong:** Wrapping queries in `prisma.$transaction()` (the org-scoped client) can have unexpected behavior with the custom Prisma extension.
**Why it happens:** The org-scoped extension is built on top of the Prisma client and may not propagate correctly through the transaction client proxy.
**How to avoid:** Always use `rawPrisma.$transaction()` as documented in CLAUDE.md. Inside the transaction callback, use the `tx` parameter directly (not `rawPrisma` or `prisma`).

---

## Code Examples

Verified patterns from official sources:

### Route Handler with Pino + Sentry + Pagination

```typescript
// Source: audit-logs/route.ts (existing reference), pino docs, sentry docs
import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const log = logger.child({ orgId, route: '/api/tickets', method: 'GET' })
  const start = Date.now()

  try {
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    Sentry.setTag('user_role', ctx.roleName)

    const { searchParams } = new URL(req.url)
    const { page, limit, skip } = parsePagination(searchParams)

    return await runWithOrgContext(orgId, async () => {
      const [total, items] = await Promise.all([
        prisma.ticket.count(),
        prisma.ticket.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      ])

      log.info({ durationMs: Date.now() - start, total }, 'Listed tickets')
      return NextResponse.json(ok(items, paginationMeta(total, { page, limit, skip })))
    })
  } catch (error) {
    log.error({ err: error, durationMs: Date.now() - start }, 'Failed to list tickets')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to list tickets'), { status: 500 })
  }
}
```

### Vitest Unit Test for Service Function

```typescript
// Source: https://github.com/prisma/prisma/discussions/20244
// __tests__/lib/permissions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { PrismaClient } from '@prisma/client'

// Must be before module imports
vi.mock('@/lib/db', () => ({
  rawPrisma: mockDeep<PrismaClient>(),
  prisma: mockDeep<PrismaClient>(),
}))

import { rawPrisma } from '@/lib/db'
import { can } from '@/lib/auth/permissions'

describe('permission checks', () => {
  beforeEach(() => mockReset(rawPrisma as any))

  it('returns true when user has matching permission', async () => {
    ;(rawPrisma as any).user.findUnique.mockResolvedValue({
      id: 'user-1',
      userRole: {
        permissions: [{ permission: { resource: 'tickets', action: 'read', scope: 'all' } }],
      },
      userPermissions: [],
      teams: [],
    })
    const result = await can('user-1', 'tickets:read:all')
    expect(result).toBe(true)
  })
})
```

### Prisma Transaction Pattern

```typescript
// Source: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
// Wrapping a multi-step write that must be atomic
import { rawPrisma } from '@/lib/db'

const result = await rawPrisma.$transaction(async (tx) => {
  const role = await tx.role.create({
    data: { name, organizationId, isSystem: false },
  })
  await tx.rolePermission.createMany({
    data: permissionIds.map(id => ({ roleId: role.id, permissionId: id })),
  })
  return role
}, {
  maxWait: 5000,  // 5s max wait to acquire connection
  timeout: 10000, // 10s max transaction duration
})
```

### GitHub Actions CI Workflow (Extended)

```yaml
# Source: https://docs.github.com/en/actions
# .github/workflows/ci.yml — extended
name: CI
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  ci:
    name: CI
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Prisma generate
        run: npx prisma generate
      - name: Architecture boundaries
        run: npm run check:architecture
      - name: Type check
        run: npx tsc --noEmit
      - name: Lint
        run: npm run lint
      - name: Test
        run: npx vitest run --reporter=verbose
        env:
          AUTH_SECRET: ci-test-secret-32-chars-minimum-x
          DATABASE_URL: ""
          DIRECT_URL: ""
      - name: Build
        run: npm run build
        env:
          AUTH_SECRET: ci-test-secret-32-chars-minimum-x
```

**Note on DATABASE_URL in CI:** Unit tests mock Prisma — no real DB connection needed. Setting `DATABASE_URL=""` prevents Prisma from attempting a connection during test runs. Integration tests (if added) would need a Docker Postgres service.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `console.error` in catch blocks | `pino` with `logger.error({ err })` | Phase 13 | Structured JSON, searchable in Vercel log drain |
| No test runner | Vitest | Phase 13 | PRs now blocked by test failures |
| `serverComponentsExternalPackages` | `serverExternalPackages` | Next.js 15 | Config key renamed; `next.config.ts` must use new key |
| `experimental.instrumentationHook` | stable `instrumentation.ts` | Next.js 15 | Sentry registers without experimental flag |
| `@sentry/nextjs` class-based integrations | Function-based integrations in v8 | Sentry SDK v8 | `new Integrations.X()` → `xIntegration()` |

**Deprecated/outdated:**
- `serverComponentsExternalPackages`: renamed to `serverExternalPackages` in Next.js 15 (project already uses new name for `mjml`)
- `experimental.instrumentationHook`: no longer needed in Next.js 15 — `instrumentation.ts` is stable

---

## Open Questions

1. **Pino in pino-pretty at build time**
   - What we know: `pino-pretty` is a dev-only dependency. The `next.config.ts` may need `pino-pretty` added to `serverExternalPackages` to avoid bundling warnings.
   - What's unclear: Whether Next.js 15's default externalization list includes `pino-pretty` alongside `pino`.
   - Recommendation: Add `'pino-pretty'` to the existing `serverExternalPackages` array in `next.config.ts` alongside `mjml`. Low risk.

2. **Sentry DSN environment variable name**
   - What we know: Sentry wizard creates `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` env vars.
   - What's unclear: Whether the team has a Sentry account/project configured, or if this needs to be set up from scratch.
   - Recommendation: Plan includes a Wave 0 task for Sentry project setup and DSN configuration in Vercel environment variables.

3. **Vitest coverage thresholds**
   - What we know: Claude's discretion on this. No existing test infrastructure.
   - What's unclear: Realistic coverage percentage achievable for the priority routes in a single phase.
   - Recommendation: Do not set coverage thresholds in this phase — focus on getting the priority routes covered, not hitting a percentage. Add `--coverage` reporting to CI but don't fail on threshold.

4. **Auth module in Vitest**
   - What we know: `signAuthToken`/`verifyAuthToken` use `jose` which works in Node.js. Tests can call these directly.
   - What's unclear: Whether the `AUTH_SECRET` env var resolving to `'dev-secret-change-me'` in tests is acceptable.
   - Recommendation: Set `AUTH_SECRET=ci-test-secret-32-chars-minimum-x` in the test environment (as shown in CI config). Add `.env.test` for local test runs with `vitest --env-file .env.test`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed in Wave 0) |
| Config file | `vitest.config.mts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Auth: signAuthToken/verifyAuthToken happy + error path | unit | `npx vitest run __tests__/lib/auth.test.ts` | ❌ Wave 0 |
| INFRA-01 | Permissions: can() returns true/false correctly | unit | `npx vitest run __tests__/lib/permissions.test.ts` | ❌ Wave 0 |
| INFRA-01 | Org context: runWithOrgContext injects orgId | unit | `npx vitest run __tests__/lib/org-context.test.ts` | ❌ Wave 0 |
| INFRA-01 | Tickets route: GET returns 200 + pagination meta | unit | `npx vitest run __tests__/api/tickets.test.ts` | ❌ Wave 0 |
| INFRA-01 | Tickets route: POST rejects missing fields with 400 | unit | `npx vitest run __tests__/api/tickets.test.ts` | ❌ Wave 0 |
| INFRA-02 | CI blocks on type errors | CI | `npx tsc --noEmit` | ❌ Wave 0 (step in ci.yml) |
| INFRA-02 | CI blocks on lint errors | CI | `npm run lint` | ❌ Wave 0 (step in ci.yml) |
| INFRA-02 | CI blocks on test failures | CI | `npx vitest run` | ❌ Wave 0 (step in ci.yml) |
| INFRA-03 | Logger outputs JSON with level/orgId fields | unit | `npx vitest run __tests__/lib/logger.test.ts` | ❌ Wave 0 |
| INFRA-04 | Sentry captures thrown errors in route handlers | manual-only | Trigger 500 error in staging, verify in Sentry dashboard | N/A |
| INFRA-05 | GET /api/tickets?page=1&limit=25 returns 25 items + totalCount | unit | `npx vitest run __tests__/api/tickets.test.ts` | ❌ Wave 0 |
| INFRA-06 | Role creation uses transaction (rollback on permission failure) | unit | `npx vitest run __tests__/api/roles.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.mts` — root config file
- [ ] `src/lib/__mocks__/db.ts` — Prisma mock singleton
- [ ] `__tests__/lib/auth.test.ts` — covers INFRA-01 (auth module)
- [ ] `__tests__/lib/permissions.test.ts` — covers INFRA-01 (permissions)
- [ ] `__tests__/lib/org-context.test.ts` — covers INFRA-01 (multi-tenancy)
- [ ] `__tests__/lib/logger.test.ts` — covers INFRA-03 (logger output)
- [ ] `__tests__/api/tickets.test.ts` — covers INFRA-01 + INFRA-05 (tickets route)
- [ ] `__tests__/api/roles.test.ts` — covers INFRA-06 (transaction wrapping)
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths vitest-mock-extended @testing-library/react @testing-library/dom jsdom`
- [ ] Pino install: `npm install pino pino-pretty`
- [ ] Sentry install: `npm install @sentry/nextjs` (or run wizard: `npx @sentry/wizard@latest -i nextjs`)

---

## Sources

### Primary (HIGH confidence)

- [Next.js Vitest Guide](https://nextjs.org/docs/app/guides/testing/vitest) — exact setup steps, vitest.config.mts template, async Server Component limitation
- [Sentry Next.js Manual Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) — `@sentry/nextjs >= 8.28.0`, `onRequestError`, `instrumentation.ts` pattern
- [Sentry Pino Integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/integrations/pino/) — `pinoIntegration()` config, level filtering, SDK 10.18.0+ requirement
- [Prisma Unit Testing Docs](https://www.prisma.io/docs/orm/prisma-client/testing/unit-testing) — singleton mock pattern
- [Prisma Transactions Docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) — `$transaction` API, maxWait/timeout options
- `src/app/api/settings/audit-logs/route.ts` — project reference implementation for pagination pattern
- `CLAUDE.md` — `rawPrisma.$transaction` warning, org-scoped client caution

### Secondary (MEDIUM confidence)

- [Arcjet Pino for Next.js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — singleton pattern, `serverExternalPackages` config, child logger usage
- [GitHub Discussion: mock prisma with vitest on next.js](https://github.com/prisma/prisma/discussions/20244) — `vi.mock('@/lib/db')` + `mockDeep<PrismaClient>()` working pattern
- `next.config.ts` — project-specific: `serverExternalPackages` already uses new Next.js 15 key name; `eslint.ignoreDuringBuilds: true` confirmed

### Tertiary (LOW confidence)

- WebSearch results on CI workflow patterns — structure is well-established but specific step ordering is Claude's discretion

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against official docs and Next.js 15 compatibility confirmed
- Architecture: HIGH — pagination reference implementation exists in codebase; Pino/Sentry patterns from official sources
- Pitfalls: HIGH — pino Edge runtime issue from official GitHub issue; pagination rename impact from code inspection; CLAUDE.md documents the $transaction pitfall
- Test requirements map: MEDIUM — test file structure is Claude's discretion; specific assertions depend on implementation details

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable ecosystem; Sentry SDK versioning moves fastest)

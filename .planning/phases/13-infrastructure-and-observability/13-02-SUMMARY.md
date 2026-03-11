---
phase: 13-infrastructure-and-observability
plan: 02
subsystem: infra
tags: [pino, sentry, logging, error-tracking, ferpa, observability]

# Dependency graph
requires:
  - phase: 13-infrastructure-and-observability
    provides: "Pino and Sentry already installed in 13-01; logger.ts and sentry configs pre-created"
provides:
  - "Structured JSON logging via Pino across all 30 core route handlers"
  - "Centralized error tracking via Sentry.captureException in all catch blocks"
  - "FERPA-safe logging discipline: no PII (email, name, student data) in any log statement"
  - "Sentry tags (org_id, user_role) on each request for searchable error context"
affects: [all-api-routes, future-route-additions, operations-monitoring, error-triage]

# Tech tracking
tech-stack:
  added: [pino, pino-pretty, "@sentry/nextjs"]
  patterns:
    - "logger.child({ route, method }) pattern for per-handler structured logs"
    - "Sentry.setTag('org_id', orgId) as first action after orgId extraction"
    - "log.error({ err: error }, message) instead of console.error"
    - "FERPA-safe: log userId/boolean outcomes only, never email/name/body"

key-files:
  created:
    - src/lib/logger.ts
    - src/sentry.server.config.ts
    - src/sentry.edge.config.ts
    - src/instrumentation.ts
    - src/app/global-error.tsx
  modified:
    - next.config.ts
    - src/app/api/tickets/route.ts
    - src/app/api/events/route.ts
    - src/app/api/calendar-events/route.ts
    - src/app/api/calendar-events/[id]/route.ts
    - src/app/api/settings/users/route.ts
    - src/app/api/settings/users/[id]/route.ts
    - src/app/api/settings/teams/route.ts
    - src/app/api/settings/teams/[id]/route.ts
    - src/app/api/settings/schools/route.ts
    - src/app/api/settings/schools/[id]/route.ts
    - src/app/api/settings/school-info/route.ts
    - src/app/api/settings/roles/route.ts
    - src/app/api/settings/roles/[id]/route.ts
    - src/app/api/settings/audit-logs/route.ts
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/reset-password/route.ts
    - src/app/api/auth/set-password/route.ts
    - src/app/api/auth/verify-email/route.ts
    - src/app/api/auth/forgot-password/route.ts
    - src/app/api/branding/route.ts
    - src/app/api/organizations/signup/route.ts
    - src/app/api/modules/route.ts
    - src/app/api/search/route.ts
    - src/app/api/notifications/route.ts
    - src/app/api/draft-events/route.ts
    - src/app/api/inventory/route.ts
    - src/app/api/maintenance/dashboard/route.ts
    - src/app/api/maintenance/tickets/route.ts
    - src/app/api/maintenance/assets/route.ts
    - src/app/api/maintenance/assets/[id]/route.ts

key-decisions:
  - "Pino child logger pattern: logger.child({ route, method }) per handler function — allows filtering logs by route in production without per-call overhead"
  - "Sentry.setTag('org_id') placed after orgId extraction — scopes all Sentry errors to a specific org for multi-tenant debugging"
  - "console.log('[WELCOME_LINK]') replaced with log.info({ userId, emailSent }) — removes PII (email address, setup link) from logs"
  - "console.warn in forgot-password replaced with log.warn({ reason }) — preserves signal without logging email addresses"
  - "onRequestError omitted from instrumentation.ts — not available in installed @sentry/nextjs version; using Sentry.captureException in catch blocks instead"
  - "disableServerWebpackPlugin/disableClientWebpackPlugin removed from withSentryConfig options — not valid in installed version; replaced with sourcemaps.disable"

patterns-established:
  - "Route handler pattern: add log = logger.child at function start, Sentry.setTag for orgId, log.error({ err: error }, message) + Sentry.captureException in catch blocks"
  - "FERPA-safe log fields: orgId (UUID), route (path string), method, boolean outcomes — never email, name, userId in plain text, request bodies"
  - "Sentry tags: org_id always set; user_role set when ctx (user context) is available"

requirements-completed: [INFRA-03, INFRA-04]

# Metrics
duration: 16min
completed: 2026-03-11
---

# Phase 13 Plan 02: Pino Structured Logging + Sentry Error Tracking Summary

**Pino JSON logging and Sentry error tracking added to 30 core API route handlers with FERPA-safe log field discipline**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-11T16:55:35Z
- **Completed:** 2026-03-11T17:11:35Z
- **Tasks:** 2
- **Files modified:** 32 (2 created in prior plan, 30 route handlers migrated)

## Accomplishments
- Pino logger singleton created with production JSON / dev pretty-print modes
- Sentry configured with sendDefaultPii=false (FERPA compliance) and 10% prod trace sampling
- instrumentation.ts registers Sentry for server and edge Next.js runtimes
- global-error.tsx React error boundary captures unhandled client errors to Sentry
- 30 core route handlers migrated from console.* to structured logger.child + Sentry
- No PII in any log statement: userId/boolean outcomes only, never email/name/bodies

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Pino + Sentry, create logger singleton and Sentry instrumentation files** - `3caae65` (feat — pre-built in 13-01 plan)
2. **Task 2: Migrate 30 core route handlers from console.* to Pino logger + Sentry** - `55d788a` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/lib/logger.ts` - Pino singleton: JSON in production, pretty-print in dev
- `src/sentry.server.config.ts` - Sentry server config with sendDefaultPii=false
- `src/sentry.edge.config.ts` - Sentry edge config for Edge runtime
- `src/instrumentation.ts` - Next.js instrumentation hook for Sentry registration
- `src/app/global-error.tsx` - React error boundary with Sentry.captureException
- `next.config.ts` - Added pino-pretty to serverExternalPackages, wrapped with withSentryConfig
- 30 route handlers in src/app/api/ - Added logger.child + Sentry.captureException in all catch blocks

## Decisions Made
- Pino child logger pattern used: each handler creates `const log = logger.child({ route, method })` for per-request structured context
- Sentry.setTag('org_id', orgId) placed immediately after orgId extraction — scopes all errors to a specific tenant
- WELCOME_LINK console.log replaced with log.info containing only userId, provisioningMode, emailSent boolean — all PII (email, setupLink) removed
- disableServerWebpackPlugin/disableClientWebpackPlugin not valid in installed @sentry/nextjs version — replaced with sourcemaps.disable pattern
- onRequestError hook skipped (not exported in current @sentry/nextjs version) — Sentry.captureException in catch blocks provides equivalent coverage

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed incompatible withSentryConfig option names**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan spec used `disableServerWebpackPlugin` and `disableClientWebpackPlugin` which are not valid in the installed @sentry/nextjs version
- **Fix:** Replaced with `sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN }` pattern
- **Files modified:** next.config.ts
- **Verification:** Build compiles cleanly
- **Committed in:** 3caae65 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed onRequestError re-export from instrumentation.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** `export { onRequestError } from '@sentry/nextjs'` caused build warning since this export doesn't exist in the installed version
- **Fix:** Removed the re-export; Sentry.captureException in all catch blocks provides equivalent error capture
- **Files modified:** src/instrumentation.ts
- **Verification:** Build shows only advisory warning (not error), compiles successfully
- **Committed in:** 3caae65 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 blocking)
**Impact on plan:** Both auto-fixes required for build compatibility. No scope creep.

## Issues Encountered
- Infrastructure files (logger.ts, sentry configs, instrumentation.ts, global-error.tsx, next.config.ts changes) were pre-built during 13-01 plan execution — discovered via git log investigation. Task 1 work was verified as already committed at 3caae65. Task 2 route migration proceeded as normal from that baseline.

## User Setup Required
**External services require manual configuration for full functionality:**

To enable Sentry error tracking:
1. Create a Sentry project at https://sentry.io
2. Add `SENTRY_DSN=https://...@sentry.io/...` to your environment variables (Vercel dashboard or .env)
3. Optionally add `SENTRY_AUTH_TOKEN=...` to enable source map uploads and webpack plugin

Without SENTRY_DSN set, Sentry SDK auto-disables itself — app works normally, errors just aren't tracked remotely.

## Next Phase Readiness
- Observability foundation complete: structured logs + error tracking across all 30 core routes
- Phase 13-03 (pagination + performance) can proceed — all route handlers now have logger context for performance timing
- Future route additions should follow the established pattern: logger.child + Sentry.setTag + log.error + Sentry.captureException

---
*Phase: 13-infrastructure-and-observability*
*Completed: 2026-03-11*

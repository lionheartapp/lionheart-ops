---
phase: 25-realtime-bridge-and-jwt-integration
plan: 01
subsystem: api, database
tags: [jwt, supabase-realtime, postgres-trigger, realtime, messaging]

requires:
  - phase: 23-messaging-schema
    provides: Message table schema and RLS policies
provides:
  - GET /api/auth/token endpoint returning raw JWT for browser Supabase client
  - Postgres broadcast trigger that pushes new messages to Supabase Realtime
affects: [25-02-realtime-bridge-and-jwt-integration, messaging-ui, realtime-subscriptions]

tech-stack:
  added: []
  patterns: [supabase-realtime-broadcast-trigger, jwt-token-endpoint]

key-files:
  created:
    - src/app/api/auth/token/route.ts
    - prisma/migrations/messaging_broadcast_trigger.sql
  modified: []

key-decisions:
  - "Used jose decodeJwt to extract exp from verified JWT since verifyAuthToken strips it from AuthClaims"
  - "Broadcast trigger sends full row_to_json payload so clients render without follow-up fetch"

patterns-established:
  - "Token endpoint pattern: cookie-first auth with no DB queries for lightweight JWT access"
  - "Realtime broadcast pattern: AFTER INSERT trigger with org-scoped topic naming msg:{orgId}:{channelId}"

requirements-completed: [RT-04, RT-05]

duration: 1min
completed: 2026-05-07
---

# Phase 25 Plan 01: Realtime Bridge and JWT Integration Summary

**JWT token endpoint + Postgres broadcast trigger for Supabase Realtime message delivery**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-07T20:28:46Z
- **Completed:** 2026-05-07T20:29:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /api/auth/token endpoint that returns the raw JWT for the browser Supabase client's accessToken param
- Postgres broadcast_new_message trigger that calls realtime.send() on Message INSERT with org-scoped topic naming

## Task Commits

Each task was committed atomically:

1. **Task 1: Create GET /api/auth/token endpoint** - `14b4c6f` (feat)
2. **Task 2: Create Postgres broadcast trigger SQL migration** - `1b68c4d` (feat)

## Files Created/Modified
- `src/app/api/auth/token/route.ts` - Lightweight JWT token endpoint, reads cookie/bearer, verifies, returns token + expiresAt
- `prisma/migrations/messaging_broadcast_trigger.sql` - Postgres trigger function + binding for realtime message broadcast

## Decisions Made
- Used `decodeJwt` from jose to extract `exp` timestamp after verification, since `verifyAuthToken` returns only `AuthClaims` (userId, organizationId, email) without the standard JWT fields.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] claims.exp not available on AuthClaims type**
- **Found during:** Task 1 (token endpoint)
- **Issue:** Plan specified `claims.exp` but `verifyAuthToken` returns `AuthClaims` which only has userId, organizationId, email -- no exp field
- **Fix:** Added `decodeJwt(token)` from jose after verification to extract the exp timestamp safely
- **Files modified:** src/app/api/auth/token/route.ts
- **Verification:** TypeScript compiles, exp correctly extracted from verified token
- **Committed in:** 14b4c6f

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor adaptation to get exp from JWT payload. No scope creep.

## Issues Encountered
None

## User Setup Required
None - the SQL migration file must be applied manually via Supabase SQL Editor after merging, but this is handled by the orchestrator.

## Next Phase Readiness
- Token endpoint ready for Plan 02's Supabase client to call for accessToken
- Broadcast trigger SQL ready to apply -- clients will receive realtime messages once trigger is active
- No blockers for Plan 02

---
*Phase: 25-realtime-bridge-and-jwt-integration*
*Completed: 2026-05-07*

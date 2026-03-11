---
phase: 08-auth-hardening-and-security
plan: 02
subsystem: auth
tags: [rate-limiting, security, brute-force-protection, middleware, login]

# Dependency graph
requires: []
provides:
  - In-memory sliding window rate limiter utility (RateLimiter class + pre-configured instances)
  - Login endpoint blocked after 5 failed attempts per IP per 15 minutes (HTTP 429 + Retry-After)
  - Successful login resets the rate limit counter for that IP
  - Signup endpoint limited to 5 requests per hour per IP via middleware
  - Public auth endpoints (forgot-password, set-password) limited to 30 requests per minute per IP
affects: [08-auth-hardening-and-security]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sliding window rate limiter: increment() then check() pattern — record attempt before evaluating limit
    - Rate limit counter reset on successful login to avoid penalizing legitimate users
    - Middleware-level rate limiting for public endpoints (signup, forgot-password, set-password)
    - Route-level rate limiting for login (finer-grained, IP-based via getIp helper)

key-files:
  created:
    - src/lib/rate-limit.ts
  modified:
    - src/app/api/auth/login/route.ts
    - src/middleware.ts

key-decisions:
  - "In-memory rate limiter is appropriate for single-process Vercel deployments; Redis deferred to v2.1 for horizontal scaling"
  - "Rate limit messages do not reveal account existence, window size, or exact retry time"
  - "Login limiter applied in route handler (not middleware) for finer control over reset-on-success behavior"
  - "Increment called before check so the current request counts against the limit"

patterns-established:
  - "Rate limit pattern: increment(ip) → check(ip) → return 429 if !allowed, with getRateLimitHeaders()"
  - "Reset on success: loginRateLimiter.reset(ip) called immediately after valid credentials confirmed"

requirements-completed: [AUTH-02, AUTH-03]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 8 Plan 02: Rate Limiting Summary

**In-memory sliding window rate limiter protecting login (5/15min), signup (5/hr), and public auth endpoints (30/min) with automatic counter reset on successful login**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-09T19:59:06Z
- **Completed:** 2026-03-09T20:00:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `src/lib/rate-limit.ts` with `RateLimiter` class (sliding window, configurable window/maxAttempts), cleanup interval, and three pre-configured instances
- Login endpoint now blocks requests from the same IP after 5 failed attempts within 15 minutes with HTTP 429 + Retry-After + X-RateLimit-Remaining headers
- Successful login resets the rate limit counter so legitimate users aren't locked out after a password mistake followed by a correct one
- Middleware-level rate limiting added for `/api/organizations/signup` (5/hr) and `/api/auth/forgot-password` + `/api/auth/set-password` (30/min)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rate limiter utility module** - `c31ba7d` (feat)
2. **Task 2: Wire rate limiting into login route and middleware** - `340d660` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/rate-limit.ts` - RateLimiter class, loginRateLimiter / publicApiRateLimiter / signupRateLimiter instances, getRateLimitHeaders() helper
- `src/app/api/auth/login/route.ts` - increment + check before body parsing, reset on successful credential verification
- `src/middleware.ts` - rate limit check for signup and public auth API paths before isPublicPath handling

## Decisions Made

- **In-memory vs Redis:** Used in-memory rate limiting. Each Vercel function instance has its own counter — provides best-effort protection suitable for launch. Redis deferred to v2.1.
- **Increment-then-check ordering:** `increment(ip)` is called before `check(ip)` so the current request is always counted. This is intentional — the check reports the state after recording the attempt.
- **Login in route handler, not middleware:** The login limiter is in the route handler so we can call `reset(ip)` on success while keeping middleware simple.
- **No information leakage:** 429 message says "try again later" without revealing window size, remaining time, or account existence.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Rate limiter is fully in-process.

## Next Phase Readiness

- Rate limiting complete per AUTH-02 and AUTH-03 requirements
- Login and public endpoints protected against brute-force and abuse
- Ready for remaining phase 8 plans (session management, CSRF, security headers, etc.)

## Self-Check: PASSED

- src/lib/rate-limit.ts: FOUND
- src/app/api/auth/login/route.ts: FOUND
- src/middleware.ts: FOUND
- 08-02-SUMMARY.md: FOUND
- Commit c31ba7d (Task 1): FOUND
- Commit 340d660 (Task 2): FOUND

---
*Phase: 08-auth-hardening-and-security*
*Completed: 2026-03-09*

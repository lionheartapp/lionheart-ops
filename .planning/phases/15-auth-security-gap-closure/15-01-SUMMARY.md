---
phase: 15-auth-security-gap-closure
plan: 01
subsystem: auth
tags: [jwt, cookies, rate-limiting, csrf, localstorage, security]

# Dependency graph
requires:
  - phase: 08-auth-hardening-and-security
    provides: httpOnly cookie pattern established in login route, CSRF middleware, rate limiters
provides:
  - reset-password endpoint rate-limited by publicApiRateLimiter (30 req/min per IP)
  - httpOnly auth-token and csrf-token cookies set on signup 201 response
  - Signup page and SignupModal use credentials:include and no longer write JWT to localStorage
affects: [signup flow, onboarding, auth, middleware, security posture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signup route now mirrors login route cookie pattern: auth-token (httpOnly) + csrf-token (non-httpOnly)"
    - "credentials: include on all fetch calls that trigger server-set cookies"

key-files:
  created: []
  modified:
    - src/middleware.ts
    - src/app/api/organizations/signup/route.ts
    - src/app/signup/page.tsx
    - src/app/SignupModal.tsx

key-decisions:
  - "reset-password added to publicApiRateLimiter branch (30 req/min) — same limit as forgot-password and set-password"
  - "admin.token kept in signup JSON body for backward compat — httpOnly cookie is now primary auth mechanism"
  - "org-name, org-slug, user-name, user-email remain in localStorage (non-sensitive display data for onboarding) — auth-token and org-id removed"

patterns-established:
  - "All public auth endpoints (forgot-password, set-password, reset-password) share publicApiRateLimiter"
  - "Any route that signs a JWT must also set httpOnly auth-token + csrf-token cookies on success response"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 15 Plan 01: Auth Security Gap Closure Summary

**Uniform auth security posture: reset-password rate-limited, httpOnly cookies on signup, localStorage JWT writes removed from signup flows**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T17:53:59Z
- **Completed:** 2026-03-11T17:55:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added `/api/auth/reset-password` to `publicApiRateLimiter` branch in middleware — closes the last unprotected public auth endpoint
- Set `auth-token` (httpOnly) and `csrf-token` (non-httpOnly) cookies on signup 201 response, matching the login route pattern exactly
- Removed `localStorage.setItem('auth-token', ...)` and `localStorage.setItem('org-id', ...)` from both `signup/page.tsx` and `SignupModal.tsx`
- Added `credentials: 'include'` to both signup fetch calls so browser accepts the Set-Cookie response headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Rate-limit reset-password and set httpOnly cookies on signup response** - `6937762` (feat)
2. **Task 2: Remove localStorage JWT writes from signup page and SignupModal** - `b73a377` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/middleware.ts` - Added `/api/auth/reset-password` to publicApiRateLimiter branch
- `src/app/api/organizations/signup/route.ts` - Sets httpOnly auth-token + csrf-token cookies on 201 response
- `src/app/signup/page.tsx` - Added credentials:include, removed auth-token/org-id localStorage writes
- `src/app/SignupModal.tsx` - Added credentials:include, removed auth-token/org-id localStorage writes

## Decisions Made
- `admin.token` kept in signup JSON response body for backward compatibility during the migration window — onboarding pages that read it directly will continue to work while migration completes
- Non-sensitive display values (`org-name`, `org-slug`, `user-name`, `user-email`) remain in localStorage because onboarding pages need them immediately post-redirect; AuthBridge will repopulate from `/api/auth/me` on subsequent page loads
- `reset-password` gets the same `publicApiRateLimiter` limit (30 req/min per IP) as `forgot-password` and `set-password` — consistent with the principle that all unauthenticated password-related endpoints share the same limit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly on first attempt with no type errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three auth security gaps from the v2.0 milestone audit are now closed
- Signup flow now has uniform security posture matching the login flow
- Phase 15 plan 01 requirements AUTH-02, AUTH-03, AUTH-04, AUTH-05 complete

---
*Phase: 15-auth-security-gap-closure*
*Completed: 2026-03-11*

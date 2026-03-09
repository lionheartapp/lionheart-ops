---
phase: 08-auth-hardening-and-security
plan: 03
subsystem: auth
tags: [jwt, cookies, csrf, httponly, middleware, next.js, auth]

# Dependency graph
requires:
  - phase: 08-auth-hardening-and-security/08-01
    provides: forgot-password flow, reset-password API route
  - phase: 08-auth-hardening-and-security/08-02
    provides: rate limiting, audit logging infrastructure
provides:
  - httpOnly auth-token cookie set by login and reset-password endpoints
  - csrf-token cookie (non-httpOnly) for CSRF double-submit pattern
  - CSRF validation in middleware on POST/PUT/PATCH/DELETE protected API requests
  - GET /api/auth/me endpoint for client-side auth hydration
  - POST /api/auth/logout endpoint that clears cookies server-side
  - Cookie-first token extraction in middleware and request-context.ts
  - useAuth hook fetching from server instead of localStorage
  - api-client.ts sending credentials:include and X-CSRF-Token header
affects: [all API routes using getUserContext, all pages using fetchApi, 08-04, 08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - httpOnly cookie auth with CSRF double-submit cookie pattern
    - Cookie-first with Authorization header fallback for graceful migration
    - Server-side logout via cookie clearing (maxAge=0)
    - CSRF skip when no csrf-token cookie (backward compatibility for old sessions)

key-files:
  created:
    - src/app/api/auth/me/route.ts
    - src/app/api/auth/logout/route.ts
  modified:
    - src/app/api/auth/login/route.ts
    - src/middleware.ts
    - src/lib/request-context.ts
    - src/lib/api-client.ts
    - src/lib/hooks/useAuth.ts
    - src/lib/client-auth.ts
    - src/app/login/LoginForm.tsx
    - src/app/reset-password/page.tsx
    - src/app/api/auth/reset-password/route.ts

key-decisions:
  - "isPublicPath now lists specific auth routes instead of blanket /api/auth/ — /api/auth/me and /api/auth/logout are protected; NextAuth OAuth callback URLs kept public explicitly"
  - "CSRF validation skips when csrf-token cookie is absent — preserves backward compatibility for existing localStorage sessions during migration grace period"
  - "useAuth.token returns null always — JWT is in httpOnly cookie and inaccessible to JS; pages relying on useAuth.token for API calls must use credentials:include instead"
  - "Existing page-level localStorage reads (dashboard, settings, etc.) continue working via Authorization header fallback in middleware — no breaking change during migration"

patterns-established:
  - "Cookie auth pattern: login/reset-password set auth-token (httpOnly) + csrf-token (non-httpOnly) on success response"
  - "CSRF double-submit: api-client reads csrf-token cookie, sends as X-CSRF-Token header on all requests"
  - "Dual-read pattern: middleware and getUserContext try cookie first, fall back to Authorization header"
  - "Server logout: POST /api/auth/logout sets maxAge=0 on both cookies to clear them"

requirements-completed: [AUTH-04, AUTH-05]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 08 Plan 03: Cookie-Based Auth Migration Summary

**httpOnly JWT cookies with CSRF double-submit pattern replacing localStorage token storage — backward-compatible via Authorization header fallback**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T20:07:11Z
- **Completed:** 2026-03-09T20:12:00Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- Login and reset-password routes now set `auth-token` (httpOnly) and `csrf-token` (non-httpOnly) cookies on successful auth
- Middleware reads JWT from cookie first, falls back to Authorization header for existing localStorage sessions (graceful migration — no breaking change)
- CSRF double-submit pattern: api-client reads csrf-token cookie and sends as X-CSRF-Token header; middleware validates on all state-changing requests when cookie is present
- GET /api/auth/me endpoint provides server-side user hydration via cookie; replaces localStorage reads in useAuth hook
- POST /api/auth/logout clears both cookies server-side (sets maxAge=0)
- useAuth hook rewritten to fetch from /api/auth/me on mount instead of reading localStorage
- LoginForm and reset-password page no longer write to localStorage after login

## Task Commits

Each task was committed atomically:

1. **Task 1: Server-side cookie auth** - `a65bb2d` (feat)
2. **Task 2: Client-side migration** - `c83fe94` (feat)

## Files Created/Modified

- `src/app/api/auth/login/route.ts` - Added Set-Cookie for auth-token and csrf-token on success
- `src/middleware.ts` - Cookie-first token extraction, CSRF validation, tightened isPublicPath
- `src/app/api/auth/me/route.ts` (NEW) - GET endpoint returning user+org for client hydration
- `src/app/api/auth/logout/route.ts` (NEW) - POST endpoint clearing auth cookies
- `src/lib/request-context.ts` - getUserContext reads from cookie first, falls back to header
- `src/lib/api-client.ts` - credentials:include on all fetches, CSRF token from cookie, legacy localStorage cleanup on 401
- `src/lib/hooks/useAuth.ts` - Fetches from /api/auth/me on mount; token always null; async logout calls server
- `src/lib/client-auth.ts` - Simplified to clear legacy localStorage keys and redirect
- `src/app/login/LoginForm.tsx` - credentials:include, removed all localStorage.setItem calls
- `src/app/reset-password/page.tsx` - credentials:include, removed all localStorage.setItem calls
- `src/app/api/auth/reset-password/route.ts` - Sets auth cookies on success (same pattern as login)

## Decisions Made

- **isPublicPath tightening:** The old blanket `startsWith('/api/auth/')` public rule was replaced with specific entries. /api/auth/me and /api/auth/logout are now protected (require auth cookie). NextAuth OAuth callback URLs (/api/auth/callback/, /api/auth/signin, etc.) were explicitly listed as public to preserve OAuth flow support.
- **CSRF skip for old sessions:** When no csrf-token cookie exists (old localStorage-only sessions), CSRF validation is skipped entirely to avoid breaking existing users during the migration window.
- **token: null in useAuth:** The hook's token field now always returns null. Pages that read directly from localStorage for their API calls are unaffected (they don't use useAuth). The hook is currently only used by a few components; those will get the server-fetched data instead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit NextAuth OAuth callback paths to isPublicPath**
- **Found during:** Task 1 (middleware update)
- **Issue:** The original code had `startsWith('/api/auth/')` as a public path blanket rule. After tightening to protect /api/auth/me and /api/auth/logout, OAuth callback URLs (/api/auth/callback/*, /api/auth/signin, etc.) would have been protected and broken OAuth flow.
- **Fix:** Added explicit entries for all NextAuth-managed paths: /api/auth/callback/, /api/auth/signin, /api/auth/signout, /api/auth/session, /api/auth/csrf, /api/auth/providers
- **Files modified:** src/middleware.ts
- **Verification:** TypeScript compiles clean; OAuth paths remain accessible
- **Committed in:** a65bb2d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — OAuth path preservation)
**Impact on plan:** Fix necessary to avoid breaking OAuth login flow. No scope creep.

## Issues Encountered

None — plan executed smoothly. The cookie-first/header-fallback pattern neatly handles the migration window without requiring changes to existing pages.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Cookie-based auth infrastructure complete; ready for session management hardening (plan 08-04)
- Existing pages with direct localStorage reads continue working via Authorization header fallback
- Full migration of remaining pages (dashboard, settings, etc.) to use fetchApi with credentials:include is deferred to plan 08-05 or can be done incrementally
- CSRF protection active for all new sessions; old sessions without csrf-token cookie bypass CSRF check automatically until they re-login

## Self-Check: PASSED

All created/modified files exist on disk. Both task commits (a65bb2d, c83fe94) confirmed in git history.

---
*Phase: 08-auth-hardening-and-security*
*Completed: 2026-03-09*

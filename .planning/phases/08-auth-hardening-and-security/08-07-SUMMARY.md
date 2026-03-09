---
phase: 08-auth-hardening-and-security
plan: 07
subsystem: auth
tags: [csrf, middleware, cookies, security, next.js]

# Dependency graph
requires:
  - phase: 08-auth-hardening-and-security
    provides: cookie-based auth (httpOnly auth-token + csrf-token cookies), api-client.ts with getAuthHeaders/fetchApi

provides:
  - CSRF validation runs before directOrgId early-return in middleware (AUTH-05 bypass closed)
  - SmartEventModal uses fetchApi from api-client (no localStorage, no x-org-id)
  - AddressAutocomplete uses getAuthHeaders + credentials:include (no localStorage, no x-org-id)
  - SchoolsManagement uses getCookieAuthHeaders from api-client with credentials:include on all 7 fetch calls

affects: [09-role-based-access-control, 10-feature-development, any phase extending API surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSRF-before-directOrgId: CSRF validation must precede any early-return shortcuts in middleware to prevent bypass"
    - "Cookie-first auth pattern: client components use credentials:include + getAuthHeaders() from api-client, never localStorage"

key-files:
  created: []
  modified:
    - src/middleware.ts
    - src/components/SmartEventModal.tsx
    - src/components/AddressAutocomplete.tsx
    - src/components/settings/SchoolsManagement.tsx

key-decisions:
  - "CSRF block reordered to before directOrgId shortcut — a request with x-org-id header that also has csrf-token cookie must now pass CSRF validation"
  - "directOrgId shortcut retained for backward compatibility with server-to-server flows after CSRF passes"
  - "SchoolsManagement: local getAuthHeaders replaced with thin wrapper around getCookieAuthHeaders — all 7 call sites unchanged in shape, Content-Type now comes from api-client"

patterns-established:
  - "All client components must use getAuthHeaders()/fetchApi() from @/lib/api-client — no direct localStorage reads, no manual x-org-id headers"
  - "Every fetch call in client components must include credentials: include"

requirements-completed: [AUTH-05]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 08 Plan 07: CSRF Bypass Fix and Client Auth Migration Summary

**CSRF bypass vulnerability closed (AUTH-05): middleware now validates CSRF token before the x-org-id early-return, and three client components migrated from localStorage/x-org-id to cookie-based auth via api-client**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T22:20:13Z
- **Completed:** 2026-03-09T22:22:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- CSRF validation block moved before `directOrgId` early-return in middleware — requests with `x-org-id` header can no longer bypass CSRF checks
- `SmartEventModal.tsx` migrated: `fetchApi` from api-client replaces manual fetch with localStorage tokens and `x-org-id` header
- `AddressAutocomplete.tsx` migrated: `getAuthHeaders()` + `credentials: 'include'` replace localStorage reads and `x-org-id` header
- `SchoolsManagement.tsx` migrated: local `getAuthHeaders` function (reading localStorage) replaced with thin wrapper over `getCookieAuthHeaders` from api-client; all 7 fetch calls updated with `credentials: 'include'`

## Task Commits

Each task was committed atomically:

1. **Task 1: Move CSRF validation before directOrgId early-return in middleware** - `371b162` (fix)
2. **Task 2: Migrate client components from manual x-org-id headers to cookie-based auth** - `d20303c` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `src/middleware.ts` - CSRF block reordered to execute before directOrgId shortcut; comment updated to document intent
- `src/components/SmartEventModal.tsx` - Replaced manual fetch + localStorage with `fetchApi` from api-client; removed `token`/`orgId` variables
- `src/components/AddressAutocomplete.tsx` - Added `getAuthHeaders` import; replaced localStorage reads with `credentials: 'include'` + `getAuthHeaders()`
- `src/components/settings/SchoolsManagement.tsx` - Added `getCookieAuthHeaders` import; replaced local `getAuthHeaders` function; added `credentials: 'include'` to all 7 fetch calls

## Decisions Made
- CSRF block reordered before directOrgId shortcut — ensures no shortcut path can ever skip CSRF validation, closing AUTH-05
- `directOrgId` shortcut retained after CSRF check for backward compatibility with any server-to-server or internal flows
- `SchoolsManagement` uses thin `const getAuthHeaders = () => getCookieAuthHeaders()` wrapper so all 7 existing call sites work without further changes; `Content-Type: application/json` is now included from api-client automatically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- AUTH-05 gap is now closed: CSRF validation is unconditional for all state-changing API requests with csrf-token cookie present
- Three client components now fully on cookie-based auth — no localStorage reads, no manual `x-org-id` headers
- Backward compatibility preserved: requests without csrf-token cookie still pass through (grace period for old localStorage sessions)
- Phase 08 gap closure plans can proceed or phase 09 can begin

---
*Phase: 08-auth-hardening-and-security*
*Completed: 2026-03-09*

---
phase: 20-registration-and-public-pages
plan: 05
subsystem: api, service, ui
tags: [magic-link, parent-portal, jwt, rate-limiting, qrcode, registration, email]

# Dependency graph
requires:
  - phase: 20-02
    provides: EventRegistration, RegistrationMagicLink schema models, rawPrisma, registrationEmailService patterns

provides:
  - registrationMagicLinkService: SHA-256 token issuance, consumption, rate limiting, portal JWT generation and verification
  - POST /api/registration/magic-link/request: public rate-limited magic link request endpoint
  - GET /api/registration/magic-link/validate: public token consumption endpoint returning portal JWT
  - GET /api/registration/[id]/portal: portal data endpoint authenticated via portal JWT (not staff JWT)
  - /events/portal page: parent portal with magic link flow, localStorage token storage, email request form
  - PortalView component: registration summary, QR code, schedule stubs, documents, payments, announcements

affects:
  - 20-06-staff-dashboard (registration listing shows magic link activity)
  - 21-day-of-execution (schedule blocks populated here, will replace stubs)
  - stripe-webhooks (payment status shown in portal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Portal JWTs use explicit 'portal' type claim to distinguish from staff JWTs
    - Magic link tokens stored as SHA-256 hash only — raw token never persisted
    - Portal page uses localStorage for session persistence (portalToken + registrationId)
    - Magic link request returns 200 regardless of email existence (no enumeration)
    - verifyPortalToken rejects tokens without 'portal' type claim — staff tokens cannot access portals

key-files:
  created:
    - src/lib/services/registrationMagicLinkService.ts
    - src/app/api/registration/magic-link/request/route.ts
    - src/app/api/registration/magic-link/validate/route.ts
    - src/app/api/registration/[id]/portal/route.ts
    - src/app/events/portal/page.tsx
    - src/components/registration/PortalView.tsx
  modified: []

key-decisions:
  - "Magic link tokens stored only as SHA-256 hash — even DB compromise does not expose raw tokens"
  - "Portal JWT uses 'portal' type claim — verifyPortalToken explicitly rejects staff tokens with 403 FORBIDDEN"
  - "Portal API returns 200 regardless of email registration status — prevents email enumeration (security best practice)"
  - "Portal token stored in localStorage for 4hr session persistence — cleared on expiry/401"
  - "Schedule, documents, announcements show stubs/empty states — full data populated in Phase 21"
  - "RegistrationSensitiveData intentionally excluded from portal response — FERPA/COPPA data accessible only to staff with medical permission"

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 20 Plan 05: Magic Link Auth and Parent Portal Summary

**Magic link passwordless auth with SHA-256 hashing, single-use 48hr tokens, rate limiting, portal JWT separate from staff JWT, and a mobile-first parent portal page with registration summary, QR code, schedule stubs, documents, and payment status**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-15T12:42:20Z
- **Completed:** 2026-03-15T12:46:40Z
- **Tasks:** 2
- **Files modified:** 6 (all created)

## Accomplishments

- Full magic link lifecycle service: SHA-256 token hashing, 48hr TTL, single-use enforcement, dual rate limiters (3/email/hr and 10/IP/hr), portal JWT signing with jose (4hr, 'portal' type claim), inline email sending (Resend + SMTP fallback)
- Public request endpoint (POST /api/registration/magic-link/request): rate-check-first, returns 200 regardless of email registration status, fire-and-forget magic link issuance for all active registrations
- Public validate endpoint (GET /api/registration/magic-link/validate): consumes token, marks usedAt, returns portal JWT and registrationId
- Portal data endpoint (GET /api/registration/[id]/portal): portal JWT authentication, cross-registration access prevention, returns registration + event + schedule + signatures + payments, explicitly excludes RegistrationSensitiveData
- Portal page: full magic link click handling (URL token -> validate -> store -> fetch), localStorage session persistence, request link form, expired/used/invalid link states with request-new-link UX, Framer Motion entrance animations
- PortalView component: glassmorphism cards, org branding (logo + name), event hero (cover image or gradient), registration summary with status badges, QR code generation (client-side via qrcode package), schedule stubs, signed documents with checkmarks, payment summary with balance-due calculation, announcements empty state, actions row

## Task Commits

Each task was committed atomically:

1. **Task 1: Magic link service and API routes** - `814920b` (feat)
2. **Task 2: Portal API route, portal page, and PortalView** - `6b4f5f1` (feat)

**Plan metadata:** (committed with state update)

## Files Created/Modified

- `src/lib/services/registrationMagicLinkService.ts` — checkRateLimit, issueMagicLink, consumeMagicLink, verifyPortalToken, sendMagicLinkEmail
- `src/app/api/registration/magic-link/request/route.ts` — POST handler, rate-limited, no email enumeration
- `src/app/api/registration/magic-link/validate/route.ts` — GET handler, returns portalToken + registrationId
- `src/app/api/registration/[id]/portal/route.ts` — GET handler, portal JWT auth, FERPA-safe response
- `src/app/events/portal/page.tsx` — Parent portal page with all auth state machines
- `src/components/registration/PortalView.tsx` — Portal dashboard with org branding and all sections

## Decisions Made

- Magic link tokens stored only as SHA-256 hash — even DB compromise does not expose raw tokens
- Portal JWT uses explicit 'portal' type claim — verifyPortalToken explicitly rejects staff tokens with 403 FORBIDDEN
- Portal API returns 200 regardless of email registration status — prevents email enumeration (security best practice)
- Portal token stored in localStorage for 4hr session persistence — cleared on expiry/401
- Schedule, documents, announcements show stubs/empty states — full data populated in Phase 21
- RegistrationSensitiveData intentionally excluded from portal response — FERPA/COPPA data accessible only to staff with medical permission

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All pre-existing TypeScript errors in `__tests__/lib/assistant-prompt.test.ts`, `src/components/events/project/RegistrationManagement.tsx`, and `src/components/events/project/ShareHub.tsx` were present before this plan and are unrelated to changes here. These are deferred items not in scope for this plan.

## Next Phase Readiness

- Magic link auth system complete — parents can receive links via confirmation email and request new links
- Portal page handles all authentication edge cases (expired, used, missing token)
- Portal shows stubs for schedule, documents, announcements — Phase 21 will populate these with real data
- Staff dashboard (Phase 20-06 if not yet complete) can see registrations that have accessed the portal

---
*Phase: 20-registration-and-public-pages*
*Completed: 2026-03-15*

## Self-Check: PASSED

All files exist and all commits are present:
- FOUND: src/lib/services/registrationMagicLinkService.ts
- FOUND: src/app/api/registration/magic-link/request/route.ts
- FOUND: src/app/api/registration/magic-link/validate/route.ts
- FOUND: src/app/api/registration/[id]/portal/route.ts
- FOUND: src/app/events/portal/page.tsx
- FOUND: src/components/registration/PortalView.tsx
- FOUND commit 814920b (Task 1)
- FOUND commit 6b4f5f1 (Task 2)

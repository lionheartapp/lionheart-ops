---
phase: 20-registration-and-public-pages
plan: 01
subsystem: database
tags: [prisma, registration, ferpa, coppa, turnstile, permissions, middleware]

# Dependency graph
requires:
  - phase: 19-event-foundation
    provides: EventProject hub model that RegistrationForm and EventRegistration FK into

provides:
  - 9 new Prisma registration models (RegistrationForm, RegistrationFormSection, RegistrationFormField, EventRegistration, RegistrationResponse, RegistrationSensitiveData, RegistrationSignature, RegistrationPayment, RegistrationMagicLink)
  - 4 new enums (RegistrationStatus, FieldType, FieldInputType, SignatureType, RegistrationPaymentStatus)
  - EventRegistration in orgScopedModels and softDeleteModels
  - RegistrationForm in orgScopedModels
  - events:medical:read and events:registration:manage permissions (seeded on org creation)
  - Public middleware paths for /events/, /api/events/register/, /api/registration/
  - Cloudflare Turnstile server-side verification utility
  - Smoke test stub file for all 13 REG requirements

affects:
  - 20-02 through 20-07 (registration form API, public pages, parent portal)
  - Any plan that checks /events/* routes for public access
  - Any plan using EventRegistration model

# Tech tracking
tech-stack:
  added: [Cloudflare Turnstile (server-side verification utility)]
  patterns:
    - RegistrationSensitiveData has NO organizationId — FERPA/COPPA gated data, access only through parent registration record
    - Public API pattern: verifyTurnstile() called as first action before any DB write
    - Smoke test stubs: all 13 test cases log SKIP and exit 0, replaced by implementations in later plans

key-files:
  created:
    - prisma/schema.prisma (9 new models + 4 enums + reverse relations added)
    - src/lib/turnstile.ts (Cloudflare Turnstile server-side verification)
    - scripts/smoke-registration.mjs (Wave 0 smoke test stubs, all 13 REG test cases)
  modified:
    - src/lib/db/index.ts (EventRegistration in both sets, RegistrationForm in orgScopedModels)
    - src/lib/permissions.ts (EVENTS_MEDICAL_READ + EVENTS_REGISTRATION_MANAGE constants + ADMIN role)
    - src/middleware.ts (/events/, /api/events/register/, /api/registration/ as public)
    - src/lib/services/organizationRegistrationService.ts (no direct change — permissions auto-seeded via DEFAULT_ROLES)

key-decisions:
  - "RegistrationSensitiveData has no organizationId by design — FERPA/COPPA data accessed only through registration relation, never directly queryable with org scope"
  - "RegistrationPaymentStatus enum named with Registration prefix to avoid clashes with other payment status enums in schema"
  - "events:medical:read and events:registration:manage added to ADMIN role only — medical access restricted, not for MEMBER or VIEWER"
  - "Turnstile utility returns true in dev when TURNSTILE_SECRET_KEY not set — avoids blocking local development"
  - "RegistrationForm added to orgScopedModels (has organizationId) — EventRegistration too (has organizationId + deletedAt)"

patterns-established:
  - "FERPA pattern: sensitive fields in separate model with no orgId, only accessible through parent registration relation"
  - "Smoke test stub pattern: runTest() helper + TESTS registry object + --test=<name> CLI arg for targeted runs"
  - "Public API surface pattern: all registration public routes under /events/, /api/events/register/, /api/registration/"

requirements-completed: [REG-12, REG-13]

# Metrics
duration: 4min
completed: 2026-03-15
---

# Phase 20 Plan 01: Data Foundation Summary

**9-model registration schema with FERPA-safe sensitive data isolation, new permissions seeded on org creation, public middleware paths, Turnstile utility, and 13-stub smoke test file**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-15T12:22:03Z
- **Completed:** 2026-03-15T12:26:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added 9 registration models and 4 enums to Prisma schema; prisma validate and prisma generate both pass cleanly
- Wired EventRegistration to org-scoping and soft-delete, RegistrationForm to org-scoping; added new permissions to ADMIN role and DEFAULT_ROLES so seedOrgDefaults picks them up automatically
- Created Turnstile verification utility and Wave 0 smoke test stubs covering all 13 REG requirements so downstream plans can reference targeted test commands

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 9 registration models and 4 enums to Prisma schema** - `4dfd37e` (feat)
2. **Task 2: Register org-scoping, permissions, middleware, and Turnstile utility** - `e1a0f18` (feat)
3. **Task 3: Create smoke test stub file for all 13 REG requirements** - `cda742d` (feat)

## Files Created/Modified

- `prisma/schema.prisma` - 9 new models (RegistrationForm through RegistrationMagicLink), 4 enums, reverse relations on EventProject and Organization
- `src/lib/db/index.ts` - EventRegistration in orgScopedModels and softDeleteModels; RegistrationForm in orgScopedModels
- `src/lib/permissions.ts` - EVENTS_MEDICAL_READ and EVENTS_REGISTRATION_MANAGE constants; both added to ADMIN role
- `src/middleware.ts` - /events/, /api/events/register/, /api/registration/ whitelisted as public paths
- `src/lib/turnstile.ts` - Cloudflare Turnstile server-side verification (new file, skips in dev)
- `scripts/smoke-registration.mjs` - Wave 0 stub: all 13 REG requirement test cases, exits 0, supports --test=<name>

## Decisions Made

- RegistrationSensitiveData has no organizationId by design — FERPA/COPPA-gated fields (allergies, medications, emergency contacts) are only accessible through the parent EventRegistration record, never directly org-queried
- RegistrationPaymentStatus enum named with "Registration" prefix to avoid name clashes with existing payment enums
- events:medical:read and events:registration:manage added to ADMIN role only; MEMBER and VIEWER deliberately excluded (medical access is restricted)
- Turnstile utility returns true in dev when TURNSTILE_SECRET_KEY unset to avoid blocking local development workflows
- seedOrgDefaults did not need direct code changes — adding new permissions to DEFAULT_ROLES ADMIN array means they are automatically upserted and linked to the admin role on org creation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript error in `__tests__/lib/assistant-prompt.test.ts:158` (unrelated to this plan's changes, confirmed present before Task 1 commit). Logged as out-of-scope.

## User Setup Required

None - no external service configuration required. TURNSTILE_SECRET_KEY is optional (dev skips Turnstile automatically when absent).

## Next Phase Readiness

- All 9 registration models are in the schema and Prisma client is generated — plans 20-02 through 20-07 can reference them immediately
- Permissions are seeded on org creation — no manual DB migration needed
- Public routes are unblocked — /events/* pages and /api/registration/* API routes will pass middleware without auth
- Smoke test file is ready — `node scripts/smoke-registration.mjs --test=<name>` works for all 13 test cases

---
*Phase: 20-registration-and-public-pages*
*Completed: 2026-03-15*

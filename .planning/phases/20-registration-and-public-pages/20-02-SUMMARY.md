---
phase: 20-registration-and-public-pages
plan: 02
subsystem: api
tags: [stripe, registration, prisma, supabase, storage, qrcode, turnstile, rate-limiting]

# Dependency graph
requires:
  - phase: 20-01
    provides: Prisma schema with RegistrationForm, EventRegistration, RegistrationSensitiveData, RegistrationPayment, RegistrationFormSection, RegistrationFormField models

provides:
  - registrationService: form CRUD, registration submission with capacity/waitlist, sensitive data isolation, promoteFromWaitlist atomic transaction
  - registrationPaymentService: Stripe PaymentIntents for FULL/DEPOSIT/BALANCE, discount code validation, handlePaymentSuccess for webhook
  - registrationEmailService: confirmation email with embedded QR code, balance-request email
  - storageService additions: uploadRegistrationPhoto, getSignedPhotoUrl, createSignedPhotoUploadUrl for private student-photos bucket
  - GET/POST/PUT /api/events/projects/[id]/registration-config — staff form config API
  - GET/POST /api/events/register/[eventSlug] — public registration form and submission
  - POST /api/events/register/[eventSlug]/payment-intent — public Stripe PaymentIntent creation
  - POST /api/events/register/[eventSlug]/upload — public signed upload URL for student photos
  - POST /api/registration/[id]/balance-intent — staff balance PaymentIntent creation

affects:
  - 20-03-registration-wizard-ui
  - 20-04-parent-portal
  - 20-05-staff-dashboard
  - stripe-webhooks

# Tech tracking
tech-stack:
  added: [stripe@20.4.1 (already installed), qrcode@1.5.4 (already installed)]
  patterns:
    - rawPrisma used for all public-facing registration operations (parents have no org context)
    - organizationId always resolved from form record via shareSlug, never from URL params (cross-tenant attack prevention)
    - Turnstile token verified as first action in every public POST handler
    - Rate limiting applied per-IP per-hour on public mutation endpoints
    - Sensitive medical data stored in separate RegistrationSensitiveData table, never returned from public APIs
    - Balance-intent resolves orgId from registration record (not x-org-id header) because middleware marks /api/registration/* public

key-files:
  created:
    - src/lib/services/registrationService.ts
    - src/lib/services/registrationPaymentService.ts
    - src/lib/services/registrationEmailService.ts
    - src/app/api/events/projects/[id]/registration-config/route.ts
    - src/app/api/events/register/[eventSlug]/route.ts
    - src/app/api/events/register/[eventSlug]/payment-intent/route.ts
    - src/app/api/events/register/[eventSlug]/upload/route.ts
    - src/app/api/registration/[id]/balance-intent/route.ts
  modified:
    - src/lib/services/storageService.ts

key-decisions:
  - "Public registration APIs resolve organizationId from form.shareSlug lookup, never from URL params — prevents cross-tenant registration injection"
  - "Balance-intent route reads orgId from registration record (not x-org-id header) because middleware isPublicPath covers /api/registration/* — x-org-id is not injected for these paths"
  - "upsertFormSections deletes all existing sections then re-creates — atomic replace pattern avoids stale orphaned fields"
  - "Confirmation email sent fire-and-forget (non-blocking) after successful registration submission when no payment required"
  - "Student photo bucket is private with signed URLs (1-hour TTL) — never public bucket exposure of FERPA-protected student photos"
  - "Zod v4 API differences handled: z.record requires two args, ZodError.issues not .errors"

patterns-established:
  - "Public routes validate Turnstile → rate-limit → fetch org context from DB (not header) → perform operation"
  - "Staff routes: getOrgIdFromRequest → getUserContext → assertCan → runWithOrgContext → operation"
  - "Registration service uses rawPrisma throughout — no org context for public registration flow"
  - "Capacity check uses REGISTERED status count against maxCapacity; waitlisted if full and waitlistEnabled"

requirements-completed: [REG-05, REG-10, REG-11, REG-13]

# Metrics
duration: 10min
completed: 2026-03-15
---

# Phase 20 Plan 02: Registration Service and API Backend Summary

**Stripe-integrated registration backend with form CRUD, capacity/waitlist management, FERPA-compliant sensitive data separation, QR-code confirmation emails, and Turnstile-protected public APIs for submission, payment, and photo upload**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-15T12:29:39Z
- **Completed:** 2026-03-15T12:39:24Z
- **Tasks:** 3
- **Files modified:** 9 (8 created, 1 extended)

## Accomplishments

- Full registration service layer: form CRUD with auto-slug generation, submission with capacity check + REGISTERED/WAITLISTED assignment, atomic waitlist promotion, FERPA-compliant sensitive data isolation
- Stripe payment service: createPaymentIntent (FULL/DEPOSIT), createBalanceIntent (computes remaining after deposit), discount code validation, handlePaymentSuccess webhook handler
- Registration email service: confirmation email with embedded QR code (PNG data URL), balance-request email with amount and payment link
- Storage extensions: uploadRegistrationPhoto, getSignedPhotoUrl, createSignedPhotoUploadUrl for private student-photos Supabase bucket
- 5 API routes: staff registration-config (GET/POST/PUT), public register (GET/POST), public payment-intent, public photo upload (signed URL), staff balance-intent

## Task Commits

Each task was committed atomically:

1. **Task 1: Create registration service** - `7beafff` (feat)
2. **Task 2: Create payment, email, and storage services** - `f04f2bb` (feat)
3. **Task 3: Create all API routes** - `61dc190` (feat)
4. **Task 3 fix: Zod v4 compatibility** - `b32c77b` (fix)

**Plan metadata:** (committed with state update)

## Files Created/Modified

- `src/lib/services/registrationService.ts` — Form CRUD, submitRegistration, cancelRegistration, promoteFromWaitlist, getRegistrations, getRegistrationWithSensitiveData
- `src/lib/services/registrationPaymentService.ts` — createPaymentIntent, createBalanceIntent, applyDiscountCode, handlePaymentSuccess, calculateAmount
- `src/lib/services/registrationEmailService.ts` — sendConfirmationEmail (QR code), sendBalanceRequestEmail
- `src/lib/services/storageService.ts` — Added uploadRegistrationPhoto, getSignedPhotoUrl, createSignedPhotoUploadUrl
- `src/app/api/events/projects/[id]/registration-config/route.ts` — Staff GET/POST/PUT for form config
- `src/app/api/events/register/[eventSlug]/route.ts` — Public GET (form info) and POST (submit registration)
- `src/app/api/events/register/[eventSlug]/payment-intent/route.ts` — Public POST for Stripe PaymentIntent
- `src/app/api/events/register/[eventSlug]/upload/route.ts` — Public POST for signed photo upload URL
- `src/app/api/registration/[id]/balance-intent/route.ts` — Staff POST for BALANCE PaymentIntent

## Decisions Made

- Public registration APIs resolve organizationId from form.shareSlug lookup, never from URL params — prevents cross-tenant registration injection (per research Pitfall 1)
- Balance-intent route reads orgId from registration record (not x-org-id header) because middleware marks /api/registration/* as public — the middleware does not inject x-org-id for these paths
- upsertFormSections deletes all existing sections then re-creates — atomic replace pattern, avoids stale orphaned fields
- Confirmation email sent fire-and-forget after registration when no payment required
- Student photo bucket is private — photos accessed via signed URLs only (1-hour TTL)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Balance-intent orgId resolution via registration record**
- **Found during:** Task 3 (balance-intent route creation)
- **Issue:** Plan specified using getOrgIdFromRequest, but middleware marks /api/registration/* as public (no x-org-id header injected). The route would always throw "Missing x-org-id header"
- **Fix:** Route fetches registration by ID using rawPrisma to resolve organizationId, then passes it to runWithOrgContext
- **Files modified:** src/app/api/registration/[id]/balance-intent/route.ts
- **Verification:** TypeScript compiles without errors; route correctly authenticates via JWT + assertCan then uses registration's orgId for context
- **Committed in:** 61dc190 (Task 3 commit)

**2. [Rule 1 - Bug] Zod v4 API compatibility**
- **Found during:** Task 3 verification (TypeScript compilation)
- **Issue:** z.record() in Zod v4 requires two arguments (key schema + value schema); ZodError uses .issues not .errors
- **Fix:** Changed z.record(z.unknown()) to z.record(z.string(), z.unknown()); changed all parsed.error.errors to parsed.error.issues
- **Files modified:** All 5 route files
- **Verification:** npx tsc --noEmit exits 0
- **Committed in:** b32c77b (fix commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

Stripe must be configured with `STRIPE_SECRET_KEY` environment variable. The student-photos bucket must be created as PRIVATE in the Supabase project dashboard (`yvpbnzeycowtvuxiidbj`) before photo uploads will function.

## Next Phase Readiness

- All service layer and API routes for registration are complete
- UI plans (20-03 registration wizard, 20-04 parent portal) can now call these endpoints
- Stripe webhooks (for handlePaymentSuccess) not yet wired — needed before end-to-end payment confirmation works
- Staff dashboard (20-05) can call /api/events/projects/[id]/registration-config and /api/registration/* for management views

---
*Phase: 20-registration-and-public-pages*
*Completed: 2026-03-15*

## Self-Check: PASSED

All files exist and all commits are present:
- FOUND: src/lib/services/registrationService.ts
- FOUND: src/lib/services/registrationPaymentService.ts
- FOUND: src/lib/services/registrationEmailService.ts
- FOUND: src/lib/services/storageService.ts (modified)
- FOUND: src/app/api/events/projects/[id]/registration-config/route.ts
- FOUND: src/app/api/events/register/[eventSlug]/route.ts
- FOUND: src/app/api/events/register/[eventSlug]/payment-intent/route.ts
- FOUND: src/app/api/events/register/[eventSlug]/upload/route.ts
- FOUND: src/app/api/registration/[id]/balance-intent/route.ts
- FOUND commit 7beafff (Task 1)
- FOUND commit f04f2bb (Task 2)
- FOUND commit 61dc190 (Task 3)
- FOUND commit b32c77b (Task 3 fix)

---
phase: 20-registration-and-public-pages
plan: 07
subsystem: api+testing
tags: [stripe, webhook, registration, smoke-tests, payment, email, captcha, ferpa]

# Dependency graph
requires:
  - phase: 20-04
    provides: registrationPaymentService (handlePaymentSuccess, createPaymentIntent), RegistrationPayment model
  - phase: 20-05
    provides: registrationEmailService (sendConfirmationEmail), public registration wizard, Turnstile CAPTCHA
  - phase: 20-06
    provides: share hub, registration management, FERPA medical gate, RegistrationManagement + ShareHub components

provides:
  - Stripe webhook handles payment_intent.succeeded for registration payments (calls handlePaymentSuccess + sendConfirmationEmail)
  - Stripe webhook handles payment_intent.payment_failed — updates RegistrationPayment status to 'failed'
  - smoke-registration.mjs: real test implementations for all 13 registration test cases
  - Security smoke tests (captcha-reject, medical-permission) run without auth — validate rejection behavior
  - Auth-required smoke tests skip gracefully when AUTH_TOKEN not set

affects:
  - production deployment — webhook must be registered with Stripe for payment confirmation emails to fire

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Dynamic imports in webhook handler isolate registration services from subscription code path
    - Email failures in webhook are non-fatal (try/catch, log, continue) — webhook must succeed even if email fails
    - Smoke test security assertions use status code validation (not data inspection) — works without live test data
    - Smoke test auth-required guard uses skip() with Error.skip=true for structured skip vs fail distinction

key-files:
  created:
    - scripts/smoke-registration.mjs
  modified:
    - src/app/api/platform/webhooks/stripe/route.ts

key-decisions:
  - "Email send failure in webhook is non-fatal — Stripe expects 2xx response regardless of email delivery"
  - "Dynamic import used for registration services in webhook — isolates from subscription event path"
  - "updateMany used for payment_intent.payment_failed instead of update — defensive against duplicate webhooks"
  - "EventProjectTabs Registration tab was already wired in prior plan — no changes needed"

patterns-established:
  - "Webhook non-fatal side effects: wrap in try/catch, log error, continue (never fail webhook for email)"
  - "Smoke test skip vs fail: throw Error with .skip=true property for skipped tests, throw normal Error for failures"

requirements-completed: [REG-05, REG-07, REG-09]

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 20 Plan 07: Stripe Webhook Integration and Smoke Tests Summary

**Stripe webhook now handles registration payment_intent.succeeded/failed with dynamic imports, and smoke-registration.mjs has real implementations for all 13 registration test cases including security-critical CAPTCHA rejection and FERPA medical data gate tests**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-15T13:07:31Z
- **Completed:** 2026-03-15T13:13:00Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- Stripe webhook extended with `payment_intent.succeeded` case: calls `handlePaymentSuccess` (updates RegistrationPayment + EventRegistration.paymentStatus) then sends confirmation email via `sendConfirmationEmail`. Email failures are non-fatal (try/catch) so webhook always returns 2xx.
- Stripe webhook extended with `payment_intent.payment_failed` case: uses `updateMany` for defensive duplicate-webhook handling, updates RegistrationPayment.status to 'failed' for registration payments only (metadata.registrationId check).
- Dynamic imports keep registration services out of the hot path for subscription webhooks (most calls are subscription-related, not registration payment-related).
- smoke-registration.mjs fully replaced from stubs to real test implementations: 13 tests covering form-config, custom-fields, payment-intent, signature, confirmation-email, magic-link, share-hub, waitlist-promotion, photo-upload, captcha-reject, medical-permission, public-page, wizard-steps.
- Security tests (captcha-reject, medical-permission) work without auth or test data — validate rejection behavior using status codes.
- Auth-required tests skip gracefully with `AUTH_TOKEN not set` message, not fail.

## Task Commits

1. **Task 1: Wire registration payment webhook and smoke tests** — `76694dd` (feat)
2. **Task 2: Human verification** — approved by user (human-verify checkpoint passed)

## Files Created/Modified

- `src/app/api/platform/webhooks/stripe/route.ts` — Added payment_intent.succeeded and payment_intent.payment_failed cases
- `scripts/smoke-registration.mjs` — Replaced 13 stubs with real test implementations

## Decisions Made

- Email send failure in webhook is non-fatal — Stripe requires 2xx response regardless of email provider availability
- Dynamic import used for `registrationPaymentService` and `registrationEmailService` in webhook — isolates these from the subscription event path (most webhook calls are subscription events, not registration payments)
- `updateMany` used for payment_intent.payment_failed instead of `update` — defensive against Stripe's at-least-once delivery guarantee (duplicate webhooks won't throw if payment record already updated)
- EventProjectTabs Registration tab was already wired at `src/components/events/EventProjectTabs.tsx` in a prior plan — plan referenced `src/components/events/project/EventProjectTabs.tsx` but the file is at `src/components/events/EventProjectTabs.tsx` and already has the Registration tab. No changes needed.

## Deviations from Plan

### Auto-fixed Issues

None for Task 1.

### Plan Reference Mismatch (Informational)

- Plan referenced `src/components/events/project/EventProjectTabs.tsx` but the actual file is `src/components/events/EventProjectTabs.tsx`
- The Registration tab (`RegistrationTab`, `ClipboardList` icon, `'registration'` in TabId union) was already implemented in a prior plan
- No changes were needed — the Registration tab is fully wired

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — all code compiled and tests execute correctly.

## Issues Encountered

None

## User Setup Required

For smoke tests to run the full suite against a live server, set:
- `AUTH_TOKEN` — staff JWT for auth-required tests
- `TEST_PROJECT_ID` — EventProject UUID to test form config / share hub
- `TEST_SHARE_SLUG` — registration form share slug for public endpoint tests
- `TEST_ORG_SLUG` — organization slug for public page tests

Security tests (captcha-reject, medical-permission) run without any configuration.

## Next Phase Readiness

- Phase 20 registration system fully wired and integrated
- Stripe webhook ready for production deployment
- Human verification in Task 2 confirms the visual end-to-end flow

---
*Phase: 20-registration-and-public-pages*
*Completed: 2026-03-15*

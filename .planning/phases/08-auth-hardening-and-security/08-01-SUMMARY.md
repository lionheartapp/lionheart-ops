---
phase: 08-auth-hardening-and-security
plan: 01
subsystem: auth
tags: [jwt, bcrypt, prisma, email, zod, password-reset, nodemailer, resend]

# Dependency graph
requires:
  - phase: 07-knowledge-base
    provides: stable platform for auth hardening work
provides:
  - PasswordSetupToken.type field distinguishing setup vs. reset tokens
  - POST /api/auth/forgot-password endpoint with email enumeration protection
  - POST /api/auth/reset-password endpoint returning JWT for auto-login
  - password_reset branded MJML email template
  - sendPasswordResetEmail() function in emailService
  - getResetLink() helper in password-setup.ts
  - /reset-password page with token validation and auto-login
  - Inline "Forgot password?" toggle on LoginForm
affects:
  - 08-02-rate-limiting (forgot-password and reset-password endpoints need rate limits)
  - 08-03-cookie-auth (reset-password currently uses localStorage; will migrate to cookies)
  - future auth plans that extend PasswordSetupToken

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Generic success message on forgot-password to prevent email enumeration
    - Token type field on PasswordSetupToken to distinguish setup/reset/verification flows
    - Auto-login after reset: reset-password returns same JWT response shape as login
    - Fire-and-forget email + audit log pattern in public endpoints

key-files:
  created:
    - src/app/api/auth/forgot-password/route.ts
    - src/app/api/auth/reset-password/route.ts
    - src/app/reset-password/page.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/auth/password-setup.ts
    - src/lib/email/templates.ts
    - src/lib/services/emailService.ts
    - src/lib/services/auditService.ts
    - src/app/login/LoginForm.tsx

key-decisions:
  - "forgot-password always returns generic success message — prevents email enumeration attacks"
  - "PasswordSetupToken.type field (default 'setup') allows same model to handle setup, reset, and future email-verification tokens"
  - "reset-password invalidates all previous unused reset tokens before creating a new one"
  - "reset-password returns same response shape as login endpoint for client auto-login compatibility"
  - "Forgot password link is inline state toggle in LoginForm (not a separate page) so organizationId is available without URL parameters"

patterns-established:
  - "Token flow pattern: generate → hash → store with type+expiry → validate on use → mark usedAt"
  - "Email enumeration defense: public auth endpoints always return 200 with generic message"

requirements-completed: [AUTH-01]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 8 Plan 01: Forgot Password Flow Summary

**Secure forgot-password flow using PasswordSetupToken.type field, branded reset emails via Resend, and auto-login JWT after successful password reset**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-09T22:59:22Z
- **Completed:** 2026-03-09T23:04:41Z
- **Tasks:** 2
- **Files modified:** 9 (7 modified, 2 created as new routes, 1 new page)

## Accomplishments
- Added `type` field to `PasswordSetupToken` Prisma model to distinguish setup vs. reset token flows
- Built POST /api/auth/forgot-password with email enumeration protection (always 200 with generic message)
- Built POST /api/auth/reset-password that validates token, hashes new password, marks token used, and returns auto-login JWT
- Added `password_reset` branded MJML email template using existing `wrapLayout()` pattern
- Added `sendPasswordResetEmail()` to emailService following existing email function patterns
- Added `getResetLink()` to password-setup.ts for `/reset-password?token=` URLs
- Created /reset-password page with password/confirm fields (show/hide toggles), descriptive error states for expired/used/invalid tokens, and auto-login on success
- Added inline "Forgot password?" toggle to LoginForm — clicks swap to email form without navigating away, preserving organizationId context

## Task Commits

1. **Task 1: Schema + backend - forgot password and reset password API routes** - `5e846ac` (feat)
2. **Task 2: Reset password page UI + login form "Forgot password?" link** - `706a57f` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified
- `prisma/schema.prisma` - Added `type String @default("setup")` to PasswordSetupToken model
- `src/lib/auth/password-setup.ts` - Added `getResetLink()` function
- `src/lib/email/templates.ts` - Added `password_reset` template, SUBJECTS entry, TEXT_BODIES entry
- `src/lib/services/emailService.ts` - Added `sendPasswordResetEmail()` function
- `src/lib/services/auditService.ts` - Added `user.password-reset-request` and `user.password-reset-complete` audit action types
- `src/app/api/auth/forgot-password/route.ts` - New public endpoint with Zod validation, token generation, fire-and-forget email + audit
- `src/app/api/auth/reset-password/route.ts` - New public endpoint with Zod validation, token validation, bcrypt hash, $transaction, JWT sign
- `src/app/reset-password/page.tsx` - New client page with Suspense wrapper, token-from-URL, password form, auto-login on success
- `src/app/login/LoginForm.tsx` - Added inline forgot-password mode with state toggle, email form, generic success state

## Decisions Made
- **Generic success on forgot-password:** Always returns "If an account exists..." message regardless of whether user exists — standard email enumeration defense
- **PasswordSetupToken.type field:** Default `"setup"` preserves backward compatibility with existing set-password flow; reset tokens use `"reset"` type, allowing same model and validation logic to be reused
- **Inline forgot-password in LoginForm:** Toggling state in the login form (rather than navigating to a separate page) means the `organizationId` is always available without embedding it in the URL
- **Auto-login response shape matches login:** reset-password returns the same `{ token, organizationId, organization, user }` shape as the login endpoint so the client auto-login code is identical to what LoginForm already does

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod validation error property access**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Used `parsed.error.errors` but Zod v3 exposes `.issues` for the array; TypeScript caught this
- **Fix:** Changed to `parsed.error.issues.map()` in both forgot-password and reset-password routes
- **Files modified:** src/app/api/auth/forgot-password/route.ts, src/app/api/auth/reset-password/route.ts
- **Verification:** TypeScript check passes cleanly
- **Committed in:** 5e846ac (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor TypeScript correctness fix. No scope creep.

## Issues Encountered
- None beyond the Zod `.issues` fix documented above.

## User Setup Required
None - no external service configuration required. `RESEND_API_KEY` and `MAIL_FROM` are optional existing env vars; if not configured, reset email is silently skipped but the flow still works (tokens are generated).

## Next Phase Readiness
- /api/auth/forgot-password and /api/auth/reset-password are built and should be rate-limited (plan 08-02)
- /reset-password page uses localStorage for auto-login; plan 08-03 (cookie auth) will migrate this
- Token type field is ready for plan 08-05 if email verification tokens are added

---
*Phase: 08-auth-hardening-and-security*
*Completed: 2026-03-09*

## Self-Check: PASSED

- FOUND: src/app/api/auth/forgot-password/route.ts
- FOUND: src/app/api/auth/reset-password/route.ts
- FOUND: src/app/reset-password/page.tsx
- FOUND: .planning/phases/08-auth-hardening-and-security/08-01-SUMMARY.md
- FOUND: commit 5e846ac (Task 1)
- FOUND: commit 706a57f (Task 2)

---
phase: 08-auth-hardening-and-security
plan: "05"
subsystem: auth
tags: [email-verification, password-complexity, security, auth-hardening]
dependency_graph:
  requires: [08-01, 08-03]
  provides: [email-verification-flow, password-complexity-rules, PasswordInput-component]
  affects: [login-route, signup-route, set-password-route, reset-password-route]
tech_stack:
  added: []
  patterns:
    - PasswordSetupToken reused for email-verification type (no new model)
    - Shared Zod passwordSchema enforced on both server and client
    - fire-and-forget email sends in signup + resend to avoid blocking user flows
    - Login checks emailVerified AFTER credential validation to prevent enumeration
    - Set-password and reset-password mark emailVerified (email ownership via link)
key_files:
  created:
    - src/lib/validation/password.ts
    - src/app/api/auth/verify-email/route.ts
    - src/app/api/auth/resend-verification/route.ts
    - src/app/verify-email/page.tsx
    - src/components/PasswordInput.tsx
  modified:
    - prisma/schema.prisma
    - src/lib/auth/password-setup.ts
    - src/lib/email/templates.ts
    - src/lib/services/emailService.ts
    - src/app/api/organizations/signup/route.ts
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/set-password/route.ts
    - src/app/api/auth/reset-password/route.ts
    - src/app/login/LoginForm.tsx
    - src/middleware.ts
decisions:
  - "Verification link points to /api/auth/verify-email (server redirect) — not /verify-email (client) — so cookie is set server-side before redirect"
  - "Login rate limiter reset only after both credential check AND emailVerified — prevents resetting counter on unverified-user attempts"
  - "Signup continues to return JWT token immediately for onboarding flow; emailVerified gate activates at next login"
  - "Resend rate limit: 3 tokens per hour tracked via PasswordSetupToken.createdAt count — no additional table needed"
  - "LoginForm redirects to /verify-email?email=&organizationId= so resend form is pre-filled"
metrics:
  duration_seconds: 349
  completed_date: "2026-03-09"
  tasks_completed: 2
  files_changed: 14
---

# Phase 8 Plan 05: Email Verification and Password Complexity Summary

Email verification flow (AUTH-09) and password complexity enforcement (AUTH-10) — the final two security hardening measures for the auth system.

## What Was Built

### AUTH-09: Email Verification

**Schema**: Added `emailVerified Boolean @default(false)` to the `User` model. Existing users default to `false` (will need to verify or will be auto-marked verified on next password action).

**Verification flow**:
1. User signs up → `POST /api/organizations/signup` generates a `PasswordSetupToken` with `type: 'email-verification'` and fires `sendVerificationEmail` (fire-and-forget)
2. User clicks email link → `GET /api/auth/verify-email?token=...` validates the token, marks `emailVerified: true`, optionally promotes PENDING → ACTIVE, sets httpOnly auth cookie, redirects to `/dashboard`
3. Error states redirect to `/verify-email?error=invalid` or `/verify-email?error=expired`

**Login gate**: After credential validation succeeds, login route checks `user.emailVerified`. If false, returns `403 EMAIL_NOT_VERIFIED` with `details: [{ email, organizationId }]`. LoginForm.tsx intercepts this error code and redirects to `/verify-email?email=&organizationId=` so the resend form is pre-filled.

**Resend endpoint**: `POST /api/auth/resend-verification` accepts `{ email, organizationId }`. Rate-limited to 3 sends per hour (counted via PasswordSetupToken.createdAt). Invalidates previous unused tokens before creating a new one. Returns generic success to prevent enumeration.

**Verify-email page** (`/verify-email`): Client component with 4 states:
- `check-email`: Default — "Check your email" with resend form option
- `error-expired`: Expired link with resend form
- `error-invalid`: Invalid/used link with resend form
- `resend-success`: Confirmation after resend

### AUTH-10: Password Complexity

**Shared validation module** (`src/lib/validation/password.ts`):
- `PASSWORD_RULES` — 4 rules: 8+ chars, uppercase, number, special character
- `validatePassword(pw)` — returns `{ valid, results: [{ id, label, passed }] }`
- `passwordSchema` — Zod schema with `.refine()` that enforces all 4 rules

**Server enforcement**:
- `set-password` route: replaced `password.length < 8` with `passwordSchema.parse(password)`
- `reset-password` route: replaced `z.string().min(8)` schema with `passwordSchema`
- Both routes also now set `emailVerified: true` on the user (receiving the link proves email ownership)

**PasswordInput component** (`src/components/PasswordInput.tsx`):
- Show/hide toggle, rule indicators below input
- Rules show after field has content or after blur
- Green check for passed rules, red X for failed (after touch), gray X before any interaction
- Props: `value`, `onChange`, `label`, `placeholder`, `id`, `required`, `autoComplete`, `showRules`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] LoginForm EMAIL_NOT_VERIFIED handling**
- **Found during:** Task 2 — login route was updated but the client needed to handle the new error code
- **Issue:** LoginForm would display a generic "Sign in failed" error for unverified users — poor UX
- **Fix:** Added `EMAIL_NOT_VERIFIED` code detection in LoginForm.tsx; redirects to `/verify-email` with pre-filled email and organizationId params
- **Files modified:** `src/app/login/LoginForm.tsx`
- **Commit:** 0801002

None of the core plan steps required deviation from the specified design.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/lib/validation/password.ts | FOUND |
| src/app/api/auth/verify-email/route.ts | FOUND |
| src/app/api/auth/resend-verification/route.ts | FOUND |
| src/app/verify-email/page.tsx | FOUND |
| src/components/PasswordInput.tsx | FOUND |
| Commit 0561a4f (Task 1) | FOUND |
| Commit 0801002 (Task 2) | FOUND |
| TypeScript compile | PASSED (no errors) |
| DB push (emailVerified field) | PASSED |

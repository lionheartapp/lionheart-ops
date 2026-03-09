# Phase 8: Auth Hardening & Security - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users and requests are protected by production-grade security defaults before the platform goes public. This phase delivers: forgot password flow with email reset, rate limiting on login and public endpoints, JWT migration from localStorage to httpOnly cookies with CSRF protection, input sanitization framework, file upload validation, webhook signature verification (Stripe/Clever/ClassLink), email verification on signup, and password complexity rules.

2FA/MFA, OAuth, and session management UI are explicitly out of scope (deferred to v2.1).

</domain>

<decisions>
## Implementation Decisions

### Password Reset Flow
- "Forgot password?" link appears below the password field, right-aligned (standard placement)
- User enters email → always shows "If an account exists, we sent a reset link" (prevents email enumeration)
- Branded HTML email via Resend (professional warm tone, matching existing email templates): "Hi [Name], we received a request to reset your password..."
- Reset link contains a secure random token, valid for 1 hour
- Requesting a new reset link invalidates all previous unused links for that user
- Reuse existing `PasswordSetupToken` model — add a `type` field to distinguish `setup` vs `reset`
- Reset page at `/reset-password?token=xxx` — shows password field with inline validation
- After successful reset → auto-login (set cookie, redirect to dashboard)
- Reset page is org-aware (token is tied to a user who belongs to an org)

### Password Complexity Rules
- 8+ characters, at least 1 uppercase letter, 1 number, 1 special character (AUTH-10)
- Inline validation on password fields showing which rules pass/fail as user types
- Apply to: password reset, set-password (invite flow), and signup
- Server-side Zod validation enforces the same rules

### Rate Limiting
- Login endpoint: max 5 attempts per IP per 15 minutes (AUTH-02)
- Other public endpoints: configurable per-route limits (AUTH-03)
- In-memory rate limiter (Map-based with sliding window) — suitable for single-instance Vercel deployment; Redis deferred to v2.1
- Response when limited: HTTP 429 with `Retry-After` header and message "Too many attempts. Please try again in X minutes."
- Rate limit state resets on successful login (reward correct credentials)
- Don't reveal whether the account exists in rate limit messages

### httpOnly Cookie Migration
- Login endpoint sets JWT as `httpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d` cookie named `auth-token`
- Login response still includes token in JSON body for backward compatibility during migration
- Middleware reads token from cookie first, falls back to Authorization header (dual-read)
- Client-side migration: `api-client.ts` sends requests with `credentials: 'include'` — browser auto-sends cookie
- `useAuth` hook transitions from localStorage to a `/api/auth/me` endpoint that reads the cookie server-side and returns user data
- Logout clears the cookie via `Set-Cookie: auth-token=; Max-Age=0` response + clears any remaining localStorage
- Grace period: existing localStorage tokens continue to work via Authorization header fallback until they expire naturally (up to 30 days)
- User metadata (name, avatar, role, org info) moves from localStorage to React context hydrated from `/api/auth/me`

### CSRF Protection
- Double-submit cookie pattern: server sets a `csrf-token` cookie (not httpOnly) + client reads it and sends as `X-CSRF-Token` header on state-changing requests (POST/PUT/PATCH/DELETE)
- Middleware validates that the header matches the cookie on non-GET/HEAD/OPTIONS requests
- `SameSite=Lax` on auth cookie already prevents most CSRF vectors; the token adds defense-in-depth

### Input Sanitization
- Server-side HTML sanitization on all user-submitted text fields before storage (AUTH-06)
- Use a lightweight sanitizer (e.g., `isomorphic-dompurify` or simple regex strip of `<script>`, event handlers)
- Apply as a Zod transform or middleware-level preprocessing
- Output encoding handled by React's default JSX escaping (already safe for rendering)

### File Upload Validation
- Validate MIME type against allowlist before processing (AUTH-11)
- Image uploads: `image/jpeg`, `image/png`, `image/webp`, `image/gif` only
- Document uploads: `image/*` + `application/pdf`
- Max file size: 10MB per file (configurable)
- Reject with descriptive error before any storage occurs: "File type not allowed" or "File exceeds 10MB limit"
- Apply at the API route level before calling Supabase Storage

### Webhook Signature Verification
- Stripe: verify `stripe-signature` header using `stripe.webhooks.constructEvent()` (AUTH-07)
- Clever: verify webhook signature per Clever's HMAC-SHA256 spec (AUTH-08)
- ClassLink: verify webhook signature per ClassLink's spec (AUTH-08)
- Reject unsigned or invalid-signature requests with 401 before processing payload

### Email Verification on Signup
- After signup, user receives a verification email with a secure link (AUTH-09)
- Hard block: user cannot access the authenticated dashboard until email is verified
- Login attempt by unverified user shows: "Please verify your email first. Check your inbox or [resend verification email]."
- Verification link valid for 24 hours
- "Resend verification email" button on the blocked state (max 3 resends per hour)
- Reuse `PasswordSetupToken` model with `type: 'email-verification'`
- After clicking verification link → mark user as verified, auto-login, redirect to dashboard

### Claude's Discretion
- Rate limiter implementation details (sliding window algorithm, cleanup interval)
- CSRF token generation method (crypto.randomUUID or similar)
- Sanitization library choice (DOMPurify, sanitize-html, or custom regex)
- Exact error message wording for edge cases
- Password strength meter visual design (if any beyond pass/fail indicators)
- Migration cleanup timing (when to remove localStorage fallback code)
- Webhook verification library choices for Clever/ClassLink
- `/api/auth/me` response shape and caching strategy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PasswordSetupToken` model: hashed token, expiry, usedAt — extend with `type` field for reset/verification
- `password-setup.ts`: `hashSetupToken()`, `generateSetupToken()` — reuse for reset tokens
- `emailService.ts` + `sendBrandedEmail()`: Resend integration with MJML templates — add reset/verification templates
- `signAuthToken()` / `verifyAuthToken()`: JWT with jose — extend to set/read cookies
- `middleware.ts`: request interception — extend to read cookies, validate CSRF, apply rate limits
- `api-client.ts`: centralized fetch helper — migrate to `credentials: 'include'` for cookie transport
- `useAuth.ts`: client auth hook — refactor from localStorage to `/api/auth/me` endpoint
- `client-auth.ts`: 401 handling — simplify once cookies eliminate manual token management
- `LoginForm.tsx`: login UI — add "Forgot password?" link, update to handle cookie-based auth
- `auditService.ts`: `audit()` + `getIp()` — reuse for rate limiting IP extraction

### Established Patterns
- Token hashing: `hashSetupToken()` uses SHA-256 hex digest — same pattern for reset tokens
- API routes: `getOrgIdFromRequest` → `getUserContext` → `assertCan` → `runWithOrgContext`
- Email templates: branded HTML via Resend `sendBrandedEmail()` with consistent tone
- Zod validation: server-side on all route inputs — extend schemas with password complexity rules
- Public paths in middleware: `isPublicPath()` function — add reset/verification endpoints

### Integration Points
- `prisma/schema.prisma`: add `type` field to PasswordSetupToken, add `emailVerified` field to User
- `src/middleware.ts`: cookie reading, CSRF validation, rate limiting hooks
- `src/lib/auth.ts`: cookie setting/clearing helpers
- `src/lib/api-client.ts`: migrate from Bearer token to cookie-based auth
- `src/lib/hooks/useAuth.ts`: refactor from localStorage to server-hydrated context
- `src/lib/client-auth.ts`: simplify or remove after cookie migration
- `src/app/login/LoginForm.tsx`: add "Forgot password?" link
- New pages: `/reset-password`, `/verify-email`
- New API routes: `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/me`
- 82+ files currently using localStorage for token — most will automatically work once `api-client.ts` switches to `credentials: 'include'`

</code_context>

<specifics>
## Specific Ideas

- User wants industry-standard security defaults across the board — no custom or unusual patterns
- Auto-login after password reset (least friction for users)
- "Forgot password?" link below password field, right-aligned (standard placement)
- Professional warm email tone matching existing notification emails
- Prevent email enumeration on all public auth endpoints (reset, verification)
- Grace period for cookie migration — don't break existing sessions

</specifics>

<deferred>
## Deferred Ideas

- 2FA/MFA via TOTP authenticator — v2.1 (AUTH-20)
- Google/Microsoft OAuth login — v2.1 (AUTH-21, AUTH-22)
- Session management UI (view/revoke sessions) — v2.1 (AUTH-23)
- "Remember Me" toggle for session duration — v2.1 (AUTH-24)
- Redis-backed rate limiting for horizontal scaling — v2.1 (SCALE-01)
- Account deletion / GDPR compliance — v2.1 (AUTH-25)

</deferred>

---

*Phase: 08-auth-hardening-and-security*
*Context gathered: 2026-03-09*

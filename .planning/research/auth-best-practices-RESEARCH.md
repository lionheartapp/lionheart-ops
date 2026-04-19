# Auth & Security Best Practices - Research

**Researched:** 2026-04-18
**Domain:** Authentication, Authorization, Session Management, Compliance
**Confidence:** HIGH (core patterns), MEDIUM (SSO provider selection), HIGH (compliance)

## Summary

Lionheart has a solid foundation with custom JWT auth, CSRF protection, rate limiting, audit logging, and org-scoped multi-tenancy. The main gaps are: (1) the 30-day non-rotating JWT is too long-lived and creates a large theft window, (2) no MFA exists, which is increasingly expected in education SaaS, (3) two parallel auth systems (custom JWT + Auth.js) create maintenance burden and confusion, and (4) no enterprise SSO path for districts that require SAML/OIDC.

The recommendation is to keep the custom JWT as the primary auth system (it is deeply integrated and working), add a sliding-window session with shorter token lifetimes, layer MFA on top, and use WorkOS (or Ory Polis/BoxyHQ Jackson as self-hosted alternative) specifically for enterprise SSO connections rather than rebuilding auth from scratch.

**Primary recommendation:** Shorten JWT to 7-day sliding window, add TOTP-based MFA as opt-in (org-enforceable), and integrate WorkOS for enterprise SSO connections when districts require it.

---

## Standard Stack

### Core (Keep / Enhance)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jose` | ^6.1.3 | JWT sign/verify | Already integrated, lightweight, edge-compatible |
| `bcryptjs` | ^3.0.3 | Password hashing | Already integrated, well-tested |
| `zod` | current | Input validation | Already integrated for all auth routes |

### Add
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `otplib` | ^12.0.1 | TOTP generation/verification | MFA implementation (authenticator apps) |
| `qrcode` | ^1.5.4 | QR code generation for TOTP setup | MFA enrollment flow |
| `@workos-inc/node` | ^7.x | Enterprise SSO (SAML/OIDC) | When districts require SSO (enterprise tier) |
| `@simplewebauthn/server` | ^10.x | WebAuthn/passkeys (future) | Phase 2 MFA - passkey support |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WorkOS for SSO | Ory Polis (fka BoxyHQ Jackson) | Free/self-hosted, but more ops burden. Use if cost is critical. |
| WorkOS for SSO | Clerk | Would require migrating ALL auth to Clerk. Too invasive for Lionheart's existing system. |
| WorkOS for SSO | Auth0 | Expensive at scale ($23k+/yr for enterprise), complex pricing. |
| Custom JWT | Auth.js (NextAuth) | Auth.js is already partially wired but NOT deeply integrated. Would require rewriting middleware, all route handlers, and the org-context flow. Cost exceeds benefit. |

**Installation (MFA phase):**
```bash
npm install otplib qrcode @types/qrcode
```

**Installation (Enterprise SSO phase):**
```bash
npm install @workos-inc/node
```

---

## Architecture Patterns

### Architecture Decision: Keep Custom JWT, Deprecate Auth.js

**Decision: Go all-in on custom JWT. Remove Auth.js/NextAuth.** (HIGH confidence)

Rationale:
- The custom JWT is the ACTUAL auth system: middleware reads it, all 400+ routes use `getUserContext`, org-context flows depend on it
- Auth.js is configured but underutilized -- it has a catch-all route and config but the real login flow bypasses it
- Migrating to Auth.js would require rewriting middleware, all route handlers, the org-context flow, and the cookie strategy
- The custom JWT is simple, well-understood, and fully under your control
- Auth.js v5 is still in beta (`next-auth@5.0.0-beta.25`) and has known issues with multi-tenant subdomain cookies

**Action:** Remove `next-auth` dependency and `src/lib/auth-config.ts`. Remove `src/app/api/auth/[...nextauth]/route.ts`. Keep Google/Microsoft OAuth as direct integrations if needed (use `googleapis` and `@azure/msal-node` directly).

### Pattern 1: Sliding Window JWT Sessions

**What:** Replace 30-day fixed-expiry JWT with 7-day sliding window
**When to use:** Every authenticated request

```typescript
// src/lib/auth.ts - Enhanced token management

const TOKEN_LIFETIME = '7d'          // 7-day expiry
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000  // Refresh if < 1 day remaining

export async function signAuthToken(claims: AuthClaims): Promise<string> {
  return await new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(getAuthSecret())
}

export function shouldRefreshToken(payload: JWTPayload): boolean {
  if (!payload.exp) return false
  const expiresAt = payload.exp * 1000
  return (expiresAt - Date.now()) < REFRESH_THRESHOLD_MS
}
```

```typescript
// In middleware.ts - after verifying token, check if refresh needed
const { payload } = await jwtVerify(token, getAuthSecret())
if (shouldRefreshToken(payload)) {
  const newToken = await signAuthToken({
    userId: String(payload.userId),
    organizationId: String(payload.organizationId),
    email: String(payload.email),
  })
  // Set refreshed cookie on response
  response.cookies.set('auth-token', newToken, authCookieOptions())
}
```

### Pattern 2: MFA with TOTP

**What:** Optional TOTP-based MFA, enforceable per-organization
**When to use:** Login flow, sensitive operations (role changes, bulk user management)

Database additions:
```prisma
model User {
  // ... existing fields
  mfaSecret        String?    // Encrypted TOTP secret
  mfaEnabled       Boolean    @default(false)
  mfaBackupCodes   String[]   @default([])  // Hashed backup codes
}

model Organization {
  // ... existing fields
  mfaRequired      Boolean    @default(false)  // Org-level MFA enforcement
}
```

Login flow becomes two-step when MFA is enabled:
1. Verify email + password -> return `{ mfaRequired: true, mfaToken: <short-lived-jwt> }`
2. Verify TOTP code with mfaToken -> return full auth token + cookie

### Pattern 3: Step-Up Authentication for Sensitive Operations

**What:** Require re-authentication for high-risk actions even within an active session
**When to use:** Changing roles, deleting users, modifying billing, accessing audit logs

```typescript
// Middleware pattern for step-up auth
export async function requireRecentAuth(req: NextRequest, maxAgeMinutes: number = 15) {
  const ctx = await getUserContext(req)
  const tokenAge = Date.now() - (ctx.iat * 1000)
  if (tokenAge > maxAgeMinutes * 60 * 1000) {
    throw new Error('RE_AUTH_REQUIRED')
  }
}
```

### Pattern 4: Enterprise SSO via WorkOS

**What:** WorkOS handles SAML/OIDC negotiation, returns user profile to your app
**When to use:** Enterprise-tier customers whose districts mandate SSO

```typescript
// src/lib/services/sso.ts
import { WorkOS } from '@workos-inc/node'

const workos = new WorkOS(process.env.WORKOS_API_KEY)

export async function getAuthorizationUrl(organizationId: string, redirectUri: string) {
  // Each org can have a WorkOS connection configured
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { workosOrganizationId: true },
  })
  if (!org?.workosOrganizationId) throw new Error('SSO not configured')

  return workos.sso.getAuthorizationURL({
    organization: org.workosOrganizationId,
    redirectURI: redirectUri,
  })
}

export async function handleSSOCallback(code: string) {
  const { profile } = await workos.sso.getProfileAndToken({
    code,
    clientID: process.env.WORKOS_CLIENT_ID!,
  })
  // profile.email, profile.firstName, profile.lastName, profile.organizationId
  // Look up or create user, then issue your standard JWT
}
```

### Recommended Project Structure (Auth Files)
```
src/lib/
  auth.ts                    # JWT sign/verify (keep as-is, enhance with sliding window)
  auth/
    cookie-options.ts        # Cookie config (keep as-is)
    permissions.ts           # RBAC (keep as-is)
    password-setup.ts        # Setup tokens (keep as-is)
    mfa.ts                   # NEW: TOTP generate/verify, backup codes
    step-up.ts               # NEW: Re-auth for sensitive ops
    password-policy.ts       # NEW: NIST-compliant validation
    sso.ts                   # NEW: WorkOS SSO integration (enterprise tier)
```

### Anti-Patterns to Avoid
- **Storing plaintext MFA secrets:** Always encrypt at rest. Use AES-256-GCM with `AUTH_SECRET` as the key.
- **MFA in the JWT:** Do not put MFA status in the JWT payload. Check the DB for `mfaEnabled` on login.
- **Session in localStorage:** The current cookie-based approach is correct. Never move tokens to localStorage.
- **Same token for MFA challenge:** The interim token (before MFA verification) must be different from the final auth token and very short-lived (5 min max).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TOTP generation | Custom HMAC-based OTP | `otplib` | RFC 6238 compliance, timing-safe comparison, tested edge cases |
| QR codes for MFA | Canvas-based QR generation | `qrcode` | Handles error correction, encoding edge cases |
| Enterprise SSO (SAML/OIDC) | Custom SAML parser | WorkOS or Ory Polis | SAML is notoriously complex; XML signature verification, clock skew, metadata exchange, IdP-specific quirks |
| Password breach checking | Custom database of leaked passwords | HaveIBeenPwned k-anonymity API | 800M+ passwords, API designed for privacy (sends only first 5 chars of hash) |
| Rate limiting | Custom in-memory counters (already built) | Keep current `RateLimiter` class | Already works with Upstash Redis fallback. Well-designed. |
| CSRF protection | Custom double-submit | Keep current implementation | Already correctly implemented in middleware |
| Passkeys/WebAuthn | Custom WebAuthn implementation | `@simplewebauthn/server` + `@simplewebauthn/browser` | Attestation formats, browser API quirks, CBOR parsing |

**Key insight:** Auth-related libraries solve problems that look simple but have catastrophic edge cases. SAML alone has caused security breaches at major companies due to XML signature wrapping attacks. TOTP has timing attacks. Password hashing has cost-factor tuning. Use proven libraries.

---

## Common Pitfalls

### Pitfall 1: 30-Day Non-Rotating JWT
**What goes wrong:** A stolen token is valid for 30 days with no way to revoke it
**Why it happens:** JWTs are stateless; there's no server-side session to invalidate
**How to avoid:** Shorten to 7-day sliding window. For immediate revocation, maintain a small Redis-backed deny list (token `jti` claim) checked in middleware.
**Warning signs:** A user reports their device was stolen; you can't log them out

### Pitfall 2: MFA Bypass via API
**What goes wrong:** MFA is enforced on the login UI but API routes accept the pre-MFA token
**Why it happens:** The MFA check exists only in the frontend login flow
**How to avoid:** Use a distinct token type for the MFA challenge phase. The full auth token is ONLY issued after MFA verification. Middleware should reject challenge tokens on protected routes.
**Warning signs:** Two different token formats that both grant access

### Pitfall 3: OAuth Account Linking Confusion
**What goes wrong:** User signs up with email, then tries Google login -- gets "account not found" or creates a duplicate
**Why it happens:** No linking strategy between email-based and OAuth-based accounts
**How to avoid:** On OAuth callback, look up by email first. If found, link the OAuth provider ID (googleId/microsoftId) to the existing account. If not found AND org allows self-registration, create. If not found AND org doesn't allow it, reject with clear error.
**Warning signs:** Users with duplicate accounts, one per auth method

### Pitfall 4: Subdomain Cookie Scope
**What goes wrong:** Auth cookie not available across subdomains, or leaks to unrelated subdomains
**Why it happens:** Missing or incorrect `domain` attribute on cookie
**How to avoid:** Current implementation is correct: `.lionheartapp.com` in production, omitted in dev. Don't change this. Verify SameSite=Lax is set (it is).
**Warning signs:** Users logged out when navigating between subdomains

### Pitfall 5: SCIM Deprovisioning Lag
**What goes wrong:** Student removed from district roster still has access for days/weeks
**Why it happens:** SCIM sync runs on a schedule, and the app doesn't revoke sessions on user deactivation
**How to avoid:** When a user's status changes to INACTIVE or DEACTIVATED, add their current token's `jti` to the deny list. Check deny list in middleware.
**Warning signs:** Audit log shows activity from deactivated users

### Pitfall 6: Password Reset Token Reuse
**What goes wrong:** A password reset token can be used multiple times
**Why it happens:** Token is only checked for expiry, not for prior use
**How to avoid:** Mark tokens as `used: true` after first use. The current `PasswordSetupToken` model should have a `usedAt` timestamp that's checked before allowing the reset.
**Warning signs:** Multiple password changes from the same reset email

---

## Code Examples

### NIST-Compliant Password Validation

```typescript
// src/lib/auth/password-policy.ts
import { z } from 'zod'

// NIST SP 800-63B Rev 4 compliant password policy
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(64, 'Password must be at most 64 characters')
  // NO composition rules (NIST prohibits mandatory uppercase/digit/symbol)
  // DO check against breached passwords (see checkBreachedPassword below)

// HaveIBeenPwned k-anonymity API - checks if password appears in known breaches
export async function checkBreachedPassword(password: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()

  const prefix = hashHex.slice(0, 5)
  const suffix = hashHex.slice(5)

  const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
  const text = await response.text()

  // Check if our suffix appears in the response
  return text.split('\n').some(line => line.startsWith(suffix))
}
```

### TOTP MFA Setup Flow

```typescript
// src/lib/auth/mfa.ts
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

const MFA_ISSUER = 'Lionheart'

export function generateMfaSecret(): string {
  return authenticator.generateSecret()
}

export async function generateMfaQrCode(email: string, secret: string): Promise<string> {
  const otpauthUrl = authenticator.keyuri(email, MFA_ISSUER, secret)
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyMfaToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret })
}

// Backup codes: generate 10 random codes, hash them, store hashes
export function generateBackupCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = []
  const hashes: string[] = []
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomUUID().slice(0, 8).toUpperCase()
    codes.push(code)
    // Use bcrypt for backup code hashes too
    // (hash synchronously at generation time, verify async at use time)
  }
  return { codes, hashes }
}
```

### Enhanced Login Flow with MFA

```typescript
// Pseudocode for POST /api/auth/login - enhanced with MFA
// Step 1: Verify credentials (existing logic)
// Step 2: Check if MFA is required
if (user.mfaEnabled || orgRequiresMfa) {
  // Issue a short-lived challenge token (NOT a full auth token)
  const challengeToken = await new SignJWT({ userId: user.id, type: 'mfa-challenge' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')  // 5 minutes to complete MFA
    .sign(getAuthSecret())

  return NextResponse.json(ok({
    mfaRequired: true,
    challengeToken,
    // Do NOT return the full auth token yet
  }))
}
// Step 3: No MFA needed -- issue full auth token (existing logic)
```

### Token Deny List (for Session Revocation)

```typescript
// src/lib/auth/token-denylist.ts
// Uses the existing Upstash Redis infrastructure from rate-limit.ts

const DENY_PREFIX = 'token:deny:'

export async function denyToken(jti: string, expiresInSeconds: number): Promise<void> {
  if (isRedisConfigured()) {
    await upstashPipeline([
      ['SET', `${DENY_PREFIX}${jti}`, '1'],
      ['EXPIRE', `${DENY_PREFIX}${jti}`, expiresInSeconds],
    ])
  }
  // In-memory fallback for non-Redis environments
  memoryDenyList.set(jti, Date.now() + expiresInSeconds * 1000)
}

export async function isTokenDenied(jti: string): Promise<boolean> {
  if (isRedisConfigured()) {
    const results = await upstashPipeline([['GET', `${DENY_PREFIX}${jti}`]])
    return results[0]?.result != null
  }
  const expiry = memoryDenyList.get(jti)
  return expiry != null && expiry > Date.now()
}
```

---

## Compliance & Standards

### FERPA (Family Educational Rights and Privacy Act)
**Applies to:** Any SaaS handling student education records
**Auth requirements:**
- Access controls that restrict data to authorized personnel only (Lionheart's RBAC handles this)
- Audit trail of all data access (AuditLog model exists)
- Reasonable security measures to protect student data
- Data breach notification requirements

**What to add:**
- Document data access in privacy policy
- Ensure audit logs capture all reads of student data, not just writes
- Support Data Privacy Agreements (DPAs) that districts will require

### COPPA (Children's Online Privacy Protection Act)
**Applies to:** If students under 13 have accounts
**Auth requirements:**
- Parental consent required for under-13 users (schools can consent on behalf of parents for educational use)
- Minimize data collection for minors
- 2025 amendments: opt-in consent required (was previously opt-out)
- Data retention only as long as necessary

**What to add:**
- Flag accounts as `isMinor` or track `dateOfBirth`
- Schools acting as agents for parental consent must be documented
- Review what data is collected on student accounts vs. staff accounts

### NIST SP 800-63B Rev 4 (Digital Identity Guidelines)
**Password policy (implement these):**
- Minimum 8 characters, support up to 64
- NO mandatory composition rules (no "must have uppercase + digit + symbol")
- NO mandatory periodic password changes
- Screen against breached password lists (HaveIBeenPwned)
- Allow paste in password fields (supports password managers)
- Rate-limit failed authentication attempts (already done)

**MFA guidance:**
- TOTP authenticator apps qualify for AAL2 (Authenticator Assurance Level 2)
- Passkeys/WebAuthn qualify for AAL2 and are recommended as phishing-resistant
- SMS OTP is deprecated by NIST for new implementations

### SOC 2 Type II
**If pursuing SOC 2 (many districts require it):**
- MFA for all administrator accounts
- Session timeout policies (idle timeout + absolute timeout)
- Password policy enforcement
- Access review procedures (periodic review of who has what access)
- Incident response plan for auth-related breaches

### State Student Privacy Laws
**121+ state laws exist beyond FERPA.** Key ones:
- **SOPIPA (CA):** Prohibits using student data for targeted advertising
- **NY Education Law 2-d:** Requires data privacy/security plans
- **CIPA:** Content filtering requirements (relevant for IT module)

**What to add:**
- A compliance settings page where districts can configure their state's requirements
- Data export and deletion capabilities per student (right to delete)
- DPA template and signing workflow

---

## Recommendations

### Priority 1: Session Hardening (Do Now)
1. **Shorten JWT to 7-day sliding window** -- refresh token in middleware when < 1 day remaining
2. **Add `jti` claim to JWTs** -- enables targeted revocation
3. **Implement token deny list** -- use existing Upstash Redis for revocation on user deactivation, password change, admin logout-all
4. **Add idle timeout** -- if no request in 24 hours, require re-login (implement via `lastActivity` timestamp in JWT, checked in middleware)

### Priority 2: Password Policy (Do Now)
1. **Remove any composition rules** if they exist in the set-password flow
2. **Add breached password checking** via HaveIBeenPwned k-anonymity API
3. **Set minimum 8 characters, maximum 64**
4. **Allow paste in password fields** (check frontend)

### Priority 3: Clean Up Auth.js (Do Soon)
1. **Remove `next-auth` dependency** and all NextAuth-related files
2. **Remove `src/lib/auth-config.ts`** and `src/app/api/auth/[...nextauth]/route.ts`
3. **Remove all `isPublicPath` entries for NextAuth routes** (`/api/auth/callback/`, `/api/auth/signin`, etc.)
4. **Keep Google/Microsoft OAuth capability** but implement as direct OAuth2 flows using the existing `googleId`/`microsoftId` fields on User

### Priority 4: MFA (Next Quarter)
1. **Implement TOTP via `otplib`** -- authenticator app support (Google Authenticator, Authy, 1Password)
2. **Backup codes** -- 10 single-use codes, shown once at enrollment
3. **Org-level enforcement toggle** -- `mfaRequired` on Organization model
4. **Admin-triggered reset** -- super-admin can disable MFA for locked-out users
5. **Do NOT implement SMS OTP** -- NIST deprecated, expensive, insecure

### Priority 5: Enterprise SSO (When Needed)
1. **Integrate WorkOS** for SAML/OIDC when a paying district requires SSO
2. **Start with SSO-only** (no SCIM) -- simplest path, handles 80% of enterprise requirements
3. **Add SCIM directory sync** when multiple districts request automated provisioning
4. **Pricing: WorkOS charges per SSO connection ($125/mo starting)** -- factor into enterprise tier pricing
5. **Alternative: Ory Polis (fka BoxyHQ Jackson)** is open-source/self-hosted if WorkOS pricing is too high

### Priority 6: Passkeys/WebAuthn (Future)
1. **Not urgent for education SaaS** -- most K-12 users are on managed Chromebooks where passkeys are still maturing
2. **Plan for it** -- the `@simplewebauthn/server` library is production-ready
3. **Implement after TOTP MFA is stable** as an alternative MFA method

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Password complexity rules | No composition rules (NIST 800-63B Rev 4) | 2024-2025 | Remove uppercase/digit/symbol requirements |
| SMS OTP for MFA | TOTP/Passkeys | 2023-2025 | SMS is deprecated by NIST, phishable, expensive |
| Long-lived session tokens | Short-lived with rotation | 2023-present | 7-day sliding window is industry standard |
| SAML only for SSO | SAML + OIDC | 2020-present | OIDC preferred for new integrations, SAML for legacy |
| Custom auth providers | Managed SSO services (WorkOS, etc.) | 2022-present | Don't hand-roll SAML parsing |
| Auth.js/NextAuth for custom apps | Direct JWT + dedicated SSO service | 2024-present | Auth.js adds complexity without value when you already have working custom auth |

**Deprecated/outdated:**
- `next-auth@5.0.0-beta.25`: Still in beta after 2+ years. Not recommended for production multi-tenant apps.
- SMS-based MFA: NIST deprecated, SIM-swap attacks common
- Password rotation policies: NIST explicitly prohibits mandatory periodic changes

---

## Open Questions

1. **Clever/ClassLink integration scope**
   - What we know: Lionheart already has webhook routes for Clever and ClassLink (`/api/webhooks/clever`, `/api/webhooks/classlink`)
   - What's unclear: Are these for rostering only, or do they also handle SSO? Districts using Clever/ClassLink for SSO would need Clever SSO or ClassLink LaunchPad integration.
   - Recommendation: Audit existing webhook implementations. For SSO, Clever uses OAuth2 and ClassLink uses OIDC -- both are simpler than SAML.

2. **Student accounts and COPPA**
   - What we know: The platform has `ITMagicLink` and student password self-service features
   - What's unclear: Do students under 13 have direct accounts? Or do only staff members have accounts?
   - Recommendation: If students have accounts, add age-gating and document school-as-agent consent model.

3. **Token revocation latency**
   - What we know: Upstash Redis is available for the deny list
   - What's unclear: Is Upstash Redis already provisioned and configured, or only the env vars are documented?
   - Recommendation: Check if `UPSTASH_REDIS_REST_URL` is set in production. If not, the in-memory fallback is per-instance and won't work across Vercel serverless functions.

---

## Sources

### Primary (HIGH confidence)
- [NIST SP 800-63B Rev 4](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63B-4.pdf) - Password policy, MFA requirements, authenticator assurance levels
- [NIST 2025 password recommendations](https://www.captaindns.com/en/blog/nist-2025-password-recommendations) - Summary of Rev 4 changes
- Lionheart codebase analysis - `src/lib/auth.ts`, `src/middleware.ts`, `src/lib/auth-config.ts`, `src/lib/rate-limit.ts`

### Secondary (MEDIUM confidence)
- [WorkOS vs Auth0 vs Clerk comparison](https://workos.com/blog/workos-vs-auth0-vs-clerk) - SSO provider analysis
- [WorkOS pricing](https://workos.com/pricing) - $125/connection/month starting
- [Best Enterprise SSO Providers for EdTech](https://ssojet.com/blog/best-enterprise-sso-providers-for-edtech-education-saas) - Education-specific SSO landscape
- [Ory Polis (BoxyHQ Jackson)](https://github.com/ory/polis) - Open-source SAML/OIDC SSO
- [FERPA compliance for SaaS](https://www.reform.app/blog/ferpa-compliance-for-saas-tools-in-education) - FERPA requirements
- [MFA best practices for SaaS 2025](https://www.loginradius.com/blog/identity/mfa-strategies-saas-platforms) - MFA strategy guidance

### Tertiary (LOW confidence - needs validation)
- [Clerk vs Auth0 for Next.js](https://clerk.com/articles/clerk-vs-auth0-for-nextjs) - Clerk marketing content, biased toward Clerk
- WorkOS education-specific features - limited primary documentation found

---

## Metadata

**Confidence breakdown:**
- Session management patterns: HIGH - NIST guidelines are definitive, sliding window is industry standard
- Password policy: HIGH - NIST SP 800-63B Rev 4 is authoritative
- MFA implementation: HIGH - otplib and TOTP are well-established
- Enterprise SSO provider: MEDIUM - WorkOS is strong recommendation but pricing/features should be validated against current needs
- Compliance (FERPA/COPPA): MEDIUM - requirements are clear but implementation details depend on whether students have direct accounts
- Auth.js removal: HIGH - codebase analysis confirms it's underutilized and the custom JWT is the real auth system

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days - stable domain, compliance landscape relatively settled)

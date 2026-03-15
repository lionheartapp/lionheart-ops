# Phase 20: Registration and Public Pages - Research

**Researched:** 2026-03-14
**Domain:** Public-facing event registration, Stripe payments, e-signatures, magic-link auth, CAPTCHA, FERPA/COPPA compliance
**Confidence:** HIGH (core stack verified), MEDIUM (payment-plan path), HIGH (security architecture)

---

## Summary

Phase 20 is the first time Lionheart exposes a public API surface — parents with no Lionheart account will land on a branded school page and complete a multi-step registration form with payment. This creates three distinct technical challenges: (1) a white-label public page that serves school branding with zero Lionheart chrome, (2) a Stripe payment integration that must handle Apple/Google Pay as well as deposit and payment-plan scenarios, and (3) a FERPA/COPPA-compliant data model that stores medical/emergency data in a permission-gated table accessible only to users with `events:medical:read`.

The existing codebase already has `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, a webhook handler (`/api/platform/webhooks/stripe/route.ts`), a `qrcode` npm package, Resend email infrastructure, and an in-memory `RateLimiter` class. The magic-link pattern has a direct precedent in `ITMagicLink` (tokenHash, expiresAt, usedAt). Cloudflare Turnstile is new to this codebase; it requires a new env var pair (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`).

**Primary recommendation:** Build around four atomic sub-systems — RegistrationForm builder (staff side), Public Event Page + multi-step form (parent side), Stripe Payment Element for checkout, and Magic-Link Portal — connected by a single `EventRegistration` hub model that fans out to `RegistrationFormField`, `RegistrationPayment`, `RegistrationSignature`, and `RegistrationSensitiveData` (permission-gated).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REG-01 | Staff configures registration form with toggleable common fields | RegistrationFormField JSON schema with `fieldType: COMMON`, `fieldKey`, `enabled` flag |
| REG-02 | Staff adds custom form fields (text, dropdown, checkbox, number, date, file upload) | RegistrationFormField with `fieldType: CUSTOM`, label, helpText, required, options JSON |
| REG-03 | Staff organizes fields into named sections that become multi-page form steps | RegistrationFormSection with sortOrder; rendered as wizard steps with progress bar |
| REG-04 | Parents register on public white-label page (zero Lionheart branding) | `/events/[orgSlug]/[eventSlug]/register` route reads Organization branding, suppresses platform chrome |
| REG-05 | Parents pay via Stripe (credit card, Apple Pay, Google Pay) with deposit, payment plan, discount codes | Stripe Payment Element + Express Checkout Element; deposit via split PaymentIntents; Stripe Coupons for discounts |
| REG-06 | Parents sign required documents with finger (mobile) or typed name (desktop) | `react-signature-canvas` lib + typed-name fallback stored as Base64 in `RegistrationSignature` |
| REG-07 | Parents receive confirmation email with event details and unique QR code | Resend + React Email template; `qrcode` pkg generates PNG data URL embedded in email |
| REG-08 | Parents access registration portal via magic link (no account needed) | `RegistrationMagicLink` model (mirrors ITMagicLink pattern); JWT token signed with AUTH_SECRET, 48hr TTL, single-use, rate-limited 3/email/hour |
| REG-09 | Staff publishes event via Share hub with link copy, QR, email distribution, branding controls | `EventShareConfig` model; QR generated via `qrcode`; new `/api/events/projects/[id]/share` endpoint |
| REG-10 | System manages capacity with automatic waitlist promotion | `EventRegistration.status` enum: REGISTERED/WAITLISTED/CANCELLED; promotion job on cancellation |
| REG-11 | Parents upload student photo during registration | File upload stored in Supabase Storage via `storageService.ts`; URL saved on `EventRegistration.photoUrl` |
| REG-12 | Public registration forms protected by Cloudflare Turnstile CAPTCHA and rate limiting | Turnstile widget client-side; `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` server validation; extend existing `RateLimiter` |
| REG-13 | Medical/emergency data stored separately with `events:medical:read` permission; under-13 consent required | `RegistrationSensitiveData` table; COPPA consent flag on EventProject; permission gate in API |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | ^20.4.1 (already installed) | Stripe SDK for PaymentIntents, webhook verification | Already in repo; PCI-compliant card vault |
| `@stripe/stripe-js` | ^4.x | Stripe.js client — loads Elements securely | Required for client-side Payment Element; never expose secret key client-side |
| `@stripe/react-stripe-js` | ^2.x | React wrappers for Elements | Canonical React integration pattern |
| `react-signature-canvas` | ^1.0.6 | Canvas-based e-signature (finger/mouse) | 100% test coverage, TypeScript, wraps signature_pad |
| `qrcode` | ^1.5.4 (already installed) | Server-side QR PNG/SVG generation | Already in repo (maintenance assets use it) |
| `cloudflare-turnstile` / manual | n/a | CAPTCHA — Turnstile widget embed | No heavy SDK needed; script tag + server siteverify POST |
| Resend + `nodemailer` | already installed | Confirmation email with QR attachment | Already wired in `emailService.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/components` | ^0.0.x | React-based email templates | Confirmation email with event card + QR |
| `crypto` (Node built-in) | — | SHA-256 token hashing for magic links | Already used in ITMagicLink pattern |
| `jose` | ^6.1.3 (already installed) | Sign/verify magic-link JWTs | Reuse existing `signAuthToken`/`verifyAuthToken` pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Payment Element | Stripe Checkout (redirect) | Elements gives inline experience — no redirect bounce; required for Apple/Google Pay in-page |
| react-signature-canvas | signature_pad (vanilla) | React wrapper is easier to integrate with React Hook Form; no functional difference |
| In-memory RateLimiter | @upstash/ratelimit + Redis | In-memory already used in this codebase; sufficient for single Vercel function instance; add Redis if multi-region needed |
| Cloudflare Turnstile | hCaptcha / reCAPTCHA | Turnstile is privacy-first, no user interaction required (invisible mode), free tier generous |

### Installation

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js react-signature-canvas
# @react-email/components may already be in repo — check before installing
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/
    api/
      events/
        projects/[id]/
          share/route.ts         # GET/PUT ShareConfig; generate share link
          registration-config/   # GET/PUT RegistrationForm config
            route.ts
        register/[eventSlug]/    # Public registration endpoints (no auth)
          route.ts               # POST — submit registration
          payment-intent/        # POST — create PaymentIntent
            route.ts
          turnstile/             # POST — validate CAPTCHA token
            route.ts
      registration/
        [id]/
          portal/route.ts        # Parent portal data (requires magic-link JWT)
          documents/route.ts     # Sign documents
          status/route.ts        # Check registration status
        magic-link/
          request/route.ts       # POST — email magic link (rate-limited)
          validate/route.ts      # GET — consume token, issue portal JWT
    events/
      [orgSlug]/
        [eventSlug]/
          page.tsx               # Public event landing page (white-label)
          register/
            page.tsx             # Multi-step registration form
          portal/
            page.tsx             # Parent portal (magic-link gated)
  components/
    registration/
      FormBuilder.tsx            # Staff side: drag-drop field builder
      RegistrationWizard.tsx     # Parent side: multi-step form
      SignatureField.tsx         # react-signature-canvas wrapper
      PaymentStep.tsx            # Stripe Elements payment step
      PortalView.tsx             # Parent portal dashboard
  lib/
    services/
      registrationService.ts     # Core registration CRUD
      registrationPaymentService.ts   # Stripe PaymentIntent management
      registrationEmailService.ts     # Confirmation email + QR
      registrationMagicLinkService.ts # Token issue/validate/rate-limit
```

### Pattern 1: Multi-Step Registration Wizard

**What:** Form sections (defined by staff) become pages; each section becomes a wizard step with a progress bar. Form state persists in a single React context; partial submissions are saved server-side as `status: DRAFT` on each `NEXT` click.

**When to use:** REG-01, REG-02, REG-03 — all multi-section forms.

```typescript
// Source: form-cro skill + React state pattern
// Each section renders as one step:
const steps = form.sections.sort((a, b) => a.sortOrder - b.sortOrder)

// Progress indicator
<div aria-label="Step {currentStep} of {steps.length}">
  {steps.map((s, i) => (
    <div key={s.id} className={cn('step-dot', i <= currentStep && 'completed')} />
  ))}
</div>

// Save draft on Next:
await fetch(`/api/events/register/${eventSlug}`, {
  method: 'PATCH',
  body: JSON.stringify({ registrationId, sectionData, status: 'DRAFT' }),
})
```

### Pattern 2: Stripe Payment Element with Deposit

**What:** Server creates a PaymentIntent for the deposit amount. Parent completes Element; on success, a second PaymentIntent (or subscription schedule) is created for the balance. For full payment, standard single PaymentIntent.

**When to use:** REG-05 — all payment scenarios.

**Critical:** STRIPE_SECRET_KEY is server-only. NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is client-safe.

```typescript
// Source: Official Stripe docs https://docs.stripe.com/payments/payment-element
// Server: /api/events/register/[eventSlug]/payment-intent/route.ts
const paymentIntent = await stripe.paymentIntents.create({
  amount: depositAmountCents,  // deposit only
  currency: 'usd',
  automatic_payment_methods: { enabled: true },  // enables Apple Pay, Google Pay
  metadata: { registrationId, eventProjectId, paymentType: 'DEPOSIT' },
})
return { clientSecret: paymentIntent.client_secret }

// Client: PaymentStep.tsx
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

// Appearance API for white-label: match school's primary color
const appearance: Stripe.Appearance = {
  theme: 'stripe',
  variables: { colorPrimary: org.primaryColor ?? '#6366f1' },
}
```

### Pattern 3: Magic Link Auth (Parent Portal)

**What:** Parent enters email → server creates `RegistrationMagicLink` row (hashed token, 48hr TTL) → sends email with link → parent clicks → token consumed + short-lived portal JWT issued → parent sees portal.

**When to use:** REG-08 — parent portal access.

```typescript
// Source: Mirrors ITMagicLink pattern in this codebase
// registrationMagicLinkService.ts

import { createHash, randomBytes } from 'crypto'
import { signAuthToken } from '@/lib/auth'

export async function issueMagicLink(email: string, registrationId: string) {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48hr

  await rawPrisma.registrationMagicLink.create({
    data: { email, registrationId, tokenHash, expiresAt },
  })

  const link = `${process.env.NEXT_PUBLIC_APP_URL}/events/portal?token=${rawToken}`
  // send via Resend...
  return link
}

export async function consumeMagicLink(rawToken: string) {
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const link = await rawPrisma.registrationMagicLink.findUnique({
    where: { tokenHash },
    include: { registration: { include: { eventProject: true } } },
  })

  if (!link || link.expiresAt < new Date() || link.usedAt) {
    throw new Error('Invalid or expired link')
  }

  await rawPrisma.registrationMagicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  })

  // Issue short-lived portal JWT (e.g., 4 hours)
  const token = await signAuthToken({
    // Use a non-standard claim — portal tokens are NOT org user tokens
    userId: `parent:${link.registrationId}`,
    organizationId: link.registration.organizationId,
    email: link.email,
  })
  return token
}
```

### Pattern 4: Cloudflare Turnstile Validation

**What:** Client-side Turnstile widget generates a token. Every public form POST includes `cf-turnstile-response`; server validates before any business logic.

```typescript
// Source: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
// lib/turnstile.ts
export async function verifyTurnstile(token: string, ip?: string): Promise<boolean> {
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    }),
  })
  const data = await res.json()
  return data.success === true
}

// Route handler usage
const turnstileValid = await verifyTurnstile(body['cf-turnstile-response'], clientIp)
if (!turnstileValid) {
  return NextResponse.json(fail('CAPTCHA_FAILED', 'Please complete the CAPTCHA'), { status: 422 })
}
```

Client-side widget:
```html
<!-- Add to public page <head> -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

<!-- In form -->
<div class="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
```

### Pattern 5: RegistrationSensitiveData Separation (FERPA/COPPA)

**What:** Medical/emergency fields are written to a separate `RegistrationSensitiveData` row. All API endpoints that return this data check `events:medical:read` permission via `assertCan()`. COPPA consent for under-13 is stored as a flag on `EventRegistration`.

```typescript
// RegistrationSensitiveData row is created in same DB transaction as EventRegistration
// but is NEVER included in general registration queries
const [registration, _sensitiveData] = await rawPrisma.$transaction([
  rawPrisma.eventRegistration.create({ data: mainData }),
  rawPrisma.registrationSensitiveData.create({ data: { ...medicalData, registrationId: reg.id } }),
])

// API guard on medical endpoints
await assertCan(ctx.userId, PERMISSIONS.EVENTS_MEDICAL_READ)
```

### Pattern 6: White-Label Public Page

**What:** Public event pages live at `/events/[orgSlug]/[eventSlug]/register`. The route loads `Organization.logoUrl`, `Organization.theme`, `EventProject.coverImageUrl` and renders a completely Lionheart-branded-free page. No `DashboardLayout`, no sidebar.

**Critical:** Middleware must NOT require auth on `/events/[orgSlug]/**` paths.

```typescript
// middleware.ts addition to isPublicPath:
if (pathname.startsWith('/events/')) return true
if (pathname.startsWith('/api/events/register/')) return true
if (pathname.startsWith('/api/registration/magic-link/')) return true
```

### Anti-Patterns to Avoid

- **Including `RegistrationSensitiveData` in default JOINs** — Medical data must NEVER appear in paginated list endpoints; require explicit `include` gated by permission check.
- **Using org-scoped `prisma` client for registration creation** — Parent registrations come from outside `runWithOrgContext`; use `rawPrisma` with explicit `organizationId` set from the event slug lookup, then pass to a service function.
- **Storing Stripe secret key in `NEXT_PUBLIC_*`** — STRIPE_SECRET_KEY must remain server-only; only `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` may be exposed.
- **Reusing org-user JWT for parent portal** — Parent portal JWTs must carry a `role: 'parent-portal'` claim and be verified separately from staff JWTs; do not call `assertCan()` on portal routes.
- **Single-use magic-link tokens stored unhashed** — Always store SHA-256 hash, never the raw token (mirrors `ITMagicLink.tokenHash` pattern).
- **Calling Turnstile verification after business logic** — Validate Turnstile token as the FIRST action in any public POST handler before touching DB.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment UI | Custom card form | Stripe Payment Element | PCI SAQ A compliance; Apple Pay domain verification already handled by Stripe |
| E-signature canvas | Raw canvas + pointer events | `react-signature-canvas` | Handles touch, pressure, Bézier smoothing, cross-browser quirks |
| QR code generation | Custom SVG | `qrcode` npm (already installed) | Already used in maintenance module; generates PNG data URLs for email embedding |
| CAPTCHA | Custom puzzle | Cloudflare Turnstile | Privacy-compliant, no user friction, battle-tested CDN-served script |
| Magic-link token rotation | Custom hash | Node `crypto.randomBytes` + SHA-256 | Cryptographically secure; same pattern as ITMagicLink already in codebase |
| Email templating | Raw HTML strings | React Email components | Type-safe, testable, previewable email templates; Resend natively supports React Email |

**Key insight:** Payment and e-signature are extremely easy to get wrong at the PCI/legal boundary. Use vendor solutions for both; the only custom code is the orchestration layer.

---

## Common Pitfalls

### Pitfall 1: Org Scoping Bypass on Public Routes

**What goes wrong:** Public registration routes call `runWithOrgContext` but the `orgId` comes from an untrusted URL parameter — an attacker could pass a different org's ID and create cross-tenant data.
**Why it happens:** The org-scoped Prisma client injects `organizationId` automatically but trusts the value passed to `runWithOrgContext`.
**How to avoid:** Resolve `organizationId` from the event slug via a DB lookup, NOT from a URL parameter. Verify the event belongs to the resolved org before any write.
**Warning signs:** Registration API takes `?orgId=` as a query param.

### Pitfall 2: Stripe Webhook Duplicate Processing

**What goes wrong:** Stripe retries webhooks on 5xx responses; if payment confirmation logic isn't idempotent, a participant can be charged twice or registered twice.
**Why it happens:** Network errors between Stripe POST and DB write.
**How to avoid:** Use `stripePaymentIntentId` as a unique constraint on `RegistrationPayment`; wrap in `upsert`. Existing webhook handler in `/api/platform/webhooks/stripe/route.ts` shows the HMAC verification pattern to reuse.
**Warning signs:** No unique index on `stripePaymentIntentId` in `RegistrationPayment`.

### Pitfall 3: Apple Pay Domain Verification

**What goes wrong:** Apple Pay silently fails — the wallet button never appears — because the domain isn't verified with Apple.
**Why it happens:** Apple Pay requires a `.well-known/apple-developer-merchantid-domain-association` file served at the root.
**How to avoid:** Stripe handles domain verification automatically for Stripe-registered domains. For custom subdomains, use Stripe's domain verification endpoint. The public event page URL must be on a domain registered in the Stripe dashboard.
**Warning signs:** Express Checkout Element renders no wallet buttons on Safari iOS.

### Pitfall 4: Magic Link Rate Limit Bypass

**What goes wrong:** Attacker floods a target email address with 100 magic-link emails, draining Resend quota and harassing the parent.
**Why it happens:** Rate limit keyed only on IP, not on target email address.
**How to avoid:** Rate-limit on BOTH IP (10 req/hour) AND email address (3 req/hour). Requirements state "rate-limited to 3 requests per email per hour" — add a new `RateLimiter` instance keyed on `email:${normalizedEmail}`.
**Warning signs:** `magicLinkRateLimiter.increment(ip)` but no second limiter on email.

### Pitfall 5: COPPA Consent Modal Skip

**What goes wrong:** Parent completes registration for a child under 13 without explicit consent being captured, exposing the organization to COPPA liability.
**Why it happens:** Frontend skips the consent modal if `studentAge` is not computed from form data.
**How to avoid:** `EventProject.requiresCoppaConsent` flag triggers an interstitial consent screen as the FIRST step of the wizard when enabled. Record consent timestamp + IP in `EventRegistration.coppaConsentAt`.
**Warning signs:** No `coppaConsentAt` column on `EventRegistration`.

### Pitfall 6: Turnstile Token Reuse

**What goes wrong:** Attacker captures a valid Turnstile token and replays it across multiple form submissions.
**Why it happens:** Tokens are single-use at Cloudflare's side (5-minute TTL), but client code doesn't refresh the widget after a failed submission.
**How to avoid:** On any server-side validation failure, send a signal to the client to re-render the Turnstile widget. Cloudflare's token is automatically invalidated after first validation.
**Warning signs:** Widget never re-renders on form validation error.

### Pitfall 7: Waitlist Promotion Race Condition

**What goes wrong:** Two cancellations happen simultaneously; both promote the same waitlisted participant, over-filling the event.
**Why it happens:** Non-atomic capacity check + registration status update.
**How to avoid:** Use a DB transaction with a `SELECT ... FOR UPDATE` style atomic check. With Prisma, use `rawPrisma.$transaction` with a counter update and conditional check in one operation.
**Warning signs:** Promotion logic uses two separate `findFirst` + `update` calls without a transaction.

---

## Code Examples

### QR Code in Confirmation Email

```typescript
// Source: qrcode npm docs + existing codebase usage in /api/maintenance/assets/labels/route.ts
import QRCode from 'qrcode'

// Generate QR as PNG data URL for embedding in email
const qrDataUrl = await QRCode.toDataURL(
  `${process.env.NEXT_PUBLIC_APP_URL}/events/check-in/${registrationId}`,
  { width: 200, margin: 1, color: { dark: '#111827', light: '#ffffff' } }
)
// Use as <img src={qrDataUrl} /> in React Email template
```

### Stripe PaymentIntent with Discount Code

```typescript
// Source: Stripe docs https://docs.stripe.com/api/payment_intents
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Apply discount by computing discounted amount server-side
// Stripe Coupons/Discount Codes are for Checkout; for Payment Element use promo-code-to-amount calc
const discountedAmount = applyDiscountCode(baseAmount, discountCode)

const paymentIntent = await stripe.paymentIntents.create({
  amount: discountedAmount,  // always in cents
  currency: 'usd',
  automatic_payment_methods: { enabled: true },  // includes Apple Pay, Google Pay, cards
  metadata: {
    registrationId,
    eventProjectId,
    organizationId,
    discountCode: discountCode ?? null,
  },
})
```

### Waitlist Promotion (Atomic)

```typescript
// Source: Prisma docs + design pattern for concurrency
// registrationService.ts
export async function promoteFromWaitlist(eventProjectId: string, organizationId: string) {
  return rawPrisma.$transaction(async (tx) => {
    // Re-check capacity inside transaction
    const event = await tx.eventProject.findUnique({ where: { id: eventProjectId } })
    const registeredCount = await tx.eventRegistration.count({
      where: { eventProjectId, status: 'REGISTERED', deletedAt: null },
    })

    if (!event?.maxCapacity || registeredCount >= event.maxCapacity) return null

    const waitlisted = await tx.eventRegistration.findFirst({
      where: { eventProjectId, status: 'WAITLISTED', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })

    if (!waitlisted) return null

    return tx.eventRegistration.update({
      where: { id: waitlisted.id },
      data: { status: 'REGISTERED', promotedAt: new Date() },
    })
  })
}
```

### Turnstile Client Widget (React)

```typescript
// Source: Cloudflare Turnstile docs https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
// components/registration/TurnstileWidget.tsx
'use client'
import { useEffect, useRef } from 'react'

export function TurnstileWidget({ onSuccess }: { onSuccess: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !window.turnstile) return
    const id = window.turnstile.render(ref.current, {
      sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
      callback: onSuccess,
    })
    return () => window.turnstile.remove(id)
  }, [onSuccess])

  return <div ref={ref} />
}
```

---

## Data Model (New Tables for Phase 20)

These tables must be added to `schema.prisma` in Wave 0:

```prisma
// Registration form configuration (staff-built)
model RegistrationForm {
  id             String   @id @default(cuid())
  organizationId String
  eventProjectId String   @unique  // one form per event
  title          String?
  requiresPayment Boolean @default(false)
  basePrice      Int?                // cents
  depositPercent Int?                // 0-100; null = full payment only
  maxCapacity    Int?
  waitlistEnabled Boolean @default(true)
  requiresCopper Boolean  @default(false) // COPPA under-13 consent gate
  openAt         DateTime?           // auto-open
  closeAt        DateTime?           // auto-close
  shareSlug      String   @unique    // URL slug for public page
  brandingOverride Json?             // { logoUrl, primaryColor, coverImageUrl }
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  // ...relations
}

model RegistrationFormSection {
  id             String  @id @default(cuid())
  formId         String
  title          String
  description    String?
  sortOrder      Int     @default(0)
  // ...relations
}

model RegistrationFormField {
  id             String            @id @default(cuid())
  sectionId      String
  formId         String            // denormalized for fast fetch
  fieldType      FieldType         // COMMON | CUSTOM
  fieldKey       String?           // for COMMON fields: 'first_name', 'grade', 'emergency_contact', etc.
  inputType      FieldInputType    // TEXT | DROPDOWN | CHECKBOX | NUMBER | DATE | FILE | SIGNATURE
  label          String
  helpText       String?
  placeholder    String?
  required       Boolean           @default(false)
  enabled        Boolean           @default(true)
  options        Json?             // [{label, value}] for DROPDOWN/CHECKBOX
  sortOrder      Int               @default(0)
  // ...relations
}

// Parent-submitted registration
model EventRegistration {
  id                String              @id @default(cuid())
  organizationId    String
  eventProjectId    String
  formId            String
  // Participant info (non-sensitive)
  firstName         String
  lastName          String
  email             String
  phone             String?
  grade             String?
  photoUrl          String?             // student photo (Supabase Storage)
  tshirtSize        String?
  dietaryNeeds      String?             // non-sensitive; allergies are in SensitiveData
  status            RegistrationStatus  @default(DRAFT)
  // COPPA
  coppaConsentAt    DateTime?
  coppaConsentIp    String?
  // Waitlist
  promotedAt        DateTime?
  // Payment
  paymentStatus     PaymentStatus2      @default(UNPAID)  // rename to avoid clash
  // Timestamps
  submittedAt       DateTime?
  deletedAt         DateTime?
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  // Relations
  form              RegistrationForm    @relation(...)
  responses         RegistrationResponse[]
  payments          RegistrationPayment[]
  signatures        RegistrationSignature[]
  sensitiveData     RegistrationSensitiveData?  // 1:1, permission-gated
  magicLinks        RegistrationMagicLink[]

  @@index([organizationId, eventProjectId])
  @@index([status])
  @@index([email, organizationId])
}

// Answers to custom form fields
model RegistrationResponse {
  id             String  @id @default(cuid())
  registrationId String
  fieldId        String
  value          String? // for text/number/date
  values         Json?   // for multi-select
  fileUrl        String? // for file upload
  // ...relations
}

// FERPA/COPPA-gated data — NOT joinable without events:medical:read
model RegistrationSensitiveData {
  id             String   @id @default(cuid())
  registrationId String   @unique
  allergies      String?
  medications    String?
  medicalNotes   String?
  emergencyName  String?
  emergencyPhone String?
  emergencyRelationship String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  // NO direct org relation — access only through registration
}

// E-signatures
model RegistrationSignature {
  id             String  @id @default(cuid())
  registrationId String
  documentLabel  String  // "Permission Slip", "Media Release", etc.
  signatureType  SignatureType // DRAWN | TYPED
  signatureData  String  // Base64 PNG (drawn) or typed name (typed)
  signedAt       DateTime @default(now())
  ipAddress      String?
  userAgent      String?
}

// Stripe payment tracking
model RegistrationPayment {
  id                    String  @id @default(cuid())
  registrationId        String
  stripePaymentIntentId String  @unique  // prevents duplicate processing
  amount                Int     // cents
  currency              String  @default("usd")
  status                String  // 'succeeded' | 'requires_action' | 'canceled'
  paymentType           String  @default("FULL")  // FULL | DEPOSIT | BALANCE
  discountCode          String?
  discountAmount        Int?    // cents discounted
  paidAt                DateTime?
  createdAt             DateTime @default(now())
}

// Parent portal magic links
model RegistrationMagicLink {
  id             String   @id @default(cuid())
  organizationId String
  email          String
  registrationId String
  tokenHash      String   @unique  // SHA-256 of raw token
  expiresAt      DateTime
  usedAt         DateTime?          // single-use: set on consume
  createdAt      DateTime @default(now())

  @@index([email])
  @@index([expiresAt])
  @@index([registrationId])
}

// Enums (new)
enum RegistrationStatus { DRAFT REGISTERED WAITLISTED CANCELLED }
enum FieldType { COMMON CUSTOM }
enum FieldInputType { TEXT DROPDOWN CHECKBOX NUMBER DATE FILE SIGNATURE }
enum SignatureType { DRAWN TYPED }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe.js mounted directly | `@stripe/react-stripe-js` Elements provider | ~2020 | React-idiomatic; automatic loading, no ref management |
| reCAPTCHA (Google) | Cloudflare Turnstile | 2022 | Privacy-compliant; invisible mode; no cookie requirement |
| DocuSign for school waivers | Custom canvas e-signature | 2022+ (ESIGN Act compliant) | Reduces friction dramatically; legally valid for school consent purposes |
| Stripe Checkout redirect | Payment Element (inline) | 2021 | No redirect bounce; Apple/Google Pay in-page; white-label compatible |
| Raw SQL / custom ORM | Prisma v5 with soft-delete extension | Current | Already in use; stick with established pattern |

**Deprecated/outdated:**
- Stripe Invoicing payment plans: The "deposit + scheduled installments" Stripe Invoice feature is **private preview** as of 2026. Do NOT build the payment plan feature on this. Instead, implement a simple two-PaymentIntent flow: collect deposit on form submit, collect balance via a second PaymentIntent link sent in the confirmation email.
- hCaptcha/reCAPTCHA: Privacy concerns and user-interaction friction make Turnstile strictly better for this use case.

---

## Open Questions

1. **Stripe Connect vs Standard Stripe for event payments**
   - What we know: The current codebase uses standard Stripe for platform billing (subscriptions). The decision in STATE.md says "Stripe Elements for payments — PCI compliance."
   - What's unclear: Does the school receive money directly (requiring Stripe Connect so funds go to the school's Stripe account), or does Lionheart receive and remit? The STATE.md pending todo says "Verify Stripe Connect vs standard Stripe before Phase 20 planning begins."
   - Recommendation: For v3.0, use standard Stripe with Lionheart as the merchant of record; document that Stripe Connect (Express accounts for schools) is the Phase 22+ migration path. This avoids KYC onboarding complexity per school.

2. **Payment plan implementation without Stripe Invoice payment plans (private preview)**
   - What we know: Stripe's native deposit+installment invoicing is in private preview.
   - What's unclear: How to offer "payment plan" that feels native.
   - Recommendation: Implement "payment plan" as: (a) deposit PaymentIntent collected at registration, (b) remaining balance stored as `RegistrationPayment.status = 'PENDING_BALANCE'`, (c) a balance-due email sent X days before event with a one-click payment link (new PaymentIntent). This is functionally equivalent and requires no private-preview access.

3. **File upload storage for student photos and form file uploads**
   - What we know: The codebase has `storageService.ts` which references Supabase Storage.
   - What's unclear: Which bucket, what access policy (public vs signed URL), max file size.
   - Recommendation: Use Supabase Storage with a `registrations` private bucket; generate signed URLs (1-hour TTL) for viewing. Student photos get a separate `student-photos` bucket for roster/check-in display. Do not store in the public bucket.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in codebase — smoke tests via `scripts/smoke-*.mjs` |
| Config file | None — see Wave 0 |
| Quick run command | `node scripts/smoke-registration.mjs` (Wave 0 creates this) |
| Full suite command | `npm run smoke:all` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REG-01 | Form config CRUD round-trip | smoke | `node scripts/smoke-registration.mjs --test=form-config` | ❌ Wave 0 |
| REG-02 | Custom field types saved and returned | smoke | `node scripts/smoke-registration.mjs --test=custom-fields` | ❌ Wave 0 |
| REG-03 | Sections render as wizard steps with progress | manual | n/a — visual inspection | manual-only |
| REG-04 | Public page renders school logo, no Lionheart branding | manual | n/a — visual inspection | manual-only |
| REG-05 | Stripe PaymentIntent created with correct amount | smoke | `node scripts/smoke-registration.mjs --test=payment-intent` | ❌ Wave 0 |
| REG-06 | Signature stored as Base64 PNG | smoke | `node scripts/smoke-registration.mjs --test=signature` | ❌ Wave 0 |
| REG-07 | Confirmation email triggered; QR code present | smoke | `node scripts/smoke-registration.mjs --test=confirmation-email` | ❌ Wave 0 |
| REG-08 | Magic link: issue → consume → portal JWT valid | smoke | `node scripts/smoke-registration.mjs --test=magic-link` | ❌ Wave 0 |
| REG-09 | Share hub returns shareUrl and QR SVG | smoke | `node scripts/smoke-registration.mjs --test=share-hub` | ❌ Wave 0 |
| REG-10 | Cancellation triggers waitlist promotion | smoke | `node scripts/smoke-registration.mjs --test=waitlist-promotion` | ❌ Wave 0 |
| REG-11 | Student photo upload returns URL | smoke | `node scripts/smoke-registration.mjs --test=photo-upload` | ❌ Wave 0 |
| REG-12 | Invalid Turnstile token returns 422 | smoke | `node scripts/smoke-registration.mjs --test=captcha-reject` | ❌ Wave 0 |
| REG-13 | Medical data endpoint 403 without events:medical:read | smoke | `node scripts/smoke-registration.mjs --test=medical-permission` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/smoke-registration.mjs --test=<relevant-test>`
- **Per wave merge:** `npm run smoke:all`
- **Phase gate:** Full smoke suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-registration.mjs` — covers all REG requirements
- [ ] Prisma schema additions (RegistrationForm, EventRegistration, RegistrationSensitiveData, RegistrationMagicLink, RegistrationPayment, RegistrationSignature, RegistrationFormSection, RegistrationFormField)
- [ ] `npm run db:push` after schema additions
- [ ] New permission constant: `PERMISSIONS.EVENTS_MEDICAL_READ = 'events:medical:read'`
- [ ] Seed `Permission` row for `events:medical:read` via `seedOrgDefaults`
- [ ] New env vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- [ ] Middleware: add `/events/` and `/api/events/register/` and `/api/registration/` to `isPublicPath`

---

## Sources

### Primary (HIGH confidence)

- Stripe Payment Element docs: https://docs.stripe.com/payments/payment-element
- Stripe Express Checkout Element: https://docs.stripe.com/elements/express-checkout-element/accept-a-payment
- Cloudflare Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Cloudflare Turnstile client-side: https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- `qrcode` npm (already in repo, used in maintenance module): `/src/app/api/maintenance/assets/labels/route.ts`
- `ITMagicLink` pattern (codebase): `/prisma/schema.prisma` line 2942
- Existing `RateLimiter` (codebase): `/src/lib/rate-limit.ts`
- Existing Stripe webhook handler (codebase): `/src/app/api/platform/webhooks/stripe/route.ts`
- Existing `emailService.ts` (codebase): `/src/lib/services/emailService.ts`
- Existing middleware `isPublicPath` (codebase): `/src/middleware.ts`

### Secondary (MEDIUM confidence)

- react-signature-canvas npm: https://www.npmjs.com/package/react-signature-canvas — GitHub: https://github.com/agilgur5/react-signature-canvas
- Stripe invoice payment plans (private preview): https://docs.stripe.com/invoicing/payment-plans
- Next.js multi-tenant guide: https://nextjs.org/docs/app/guides/multi-tenant
- Magic link pattern with Prisma: https://dev.to/diegocasmo/simple-nextjs-magic-link-jwt-authentication-with-prisma-postgresql-and-resend-21l

### Tertiary (LOW confidence)

- FERPA/COPPA 2025 amendments: https://www.hireplicity.com/blog/ferpa-compliance-checklist-2025 — verify actual legal requirements with counsel

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Core libs (`stripe`, `qrcode`) already in repo; Turnstile and react-signature-canvas verified against npm and official docs
- Architecture: HIGH — Multi-tenant public pages pattern is established in Next.js; data model mirrors existing patterns (ITMagicLink, soft-delete, org-scoped)
- Payment plans: MEDIUM — Stripe's native deposit+installment is private preview; two-PaymentIntent workaround is proven but not Stripe's "official" payment plan product
- Pitfalls: HIGH — All verified against codebase patterns and official docs
- FERPA/COPPA architecture: HIGH (technical implementation) / MEDIUM (legal requirements — not providing legal advice)

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (30 days — stable domain; Stripe API changes rarely break existing integrations)

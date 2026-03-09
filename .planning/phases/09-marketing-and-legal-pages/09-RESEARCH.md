# Phase 9: Marketing and Legal Pages - Research

**Researched:** 2026-03-09
**Domain:** Next.js 15 App Router public pages — legal content, pricing UI, contact form, footer wiring, OAuth cleanup
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAGE-01 | Visitors can view a Privacy Policy page compliant with COPPA/FERPA for K-12 schools | Legal content structure + K-12 regulatory obligations documented below |
| PAGE-02 | Visitors can view a Terms of Service page governing platform usage | ToS content structure + SaaS standard clauses documented below |
| PAGE-03 | Visitors can view a Pricing page showing plans and costs before signup | Pricing page patterns, three-tier SaaS structure, skill guidance |
| PAGE-04 | Visitors can view an About page with company info and a working Contact form | Contact form pattern, `/api/public/contact` route, email delivery via existing Resend infra |
| PAGE-05 | All footer links navigate to real pages (no 404s or "coming soon") | Footer audit shows all links are `href="#"` placeholders — full wiring needed |
| PAGE-06 | "Coming soon" OAuth buttons on signup are hidden or replaced with clean non-OAuth flow | OAuth button removal pattern documented; signup page already has full email/password flow |
</phase_requirements>

---

## Summary

Phase 9 is primarily a content and UI phase — no new Prisma models, no new auth primitives. All work lives in `src/app/` as new public page routes and one new public API route for the contact form.

The landing page (`src/app/page.tsx`) already has a complete footer with four nav columns (Product, Company, Legal) where every link is `href="#"`. The signup page (`src/app/signup/page.tsx`) has Google and Microsoft OAuth buttons that call `setError('...coming soon')` — they need to be removed or hidden, not re-implemented. The existing email infrastructure (Resend via `emailService.ts`) is fully usable for the contact form without adding new dependencies.

The legal pages (Privacy Policy, Terms of Service) require substantive content that explicitly covers COPPA (children under 13) and FERPA (student education records) as required by PAGE-01. These are K-12 school-facing SaaS platforms and both regulations apply. Content can be a good-faith "platform operator" policy; it does not need external legal counsel for launch (placeholder language is acceptable per STATE.md note about legal review). The Pricing page follows a three-tier SaaS pattern using the project's existing pricing-strategy and page-cro skills.

**Primary recommendation:** Add four new App Router page routes (`/privacy`, `/terms`, `/pricing`, `/about`), one public API route (`/api/public/contact`), update footer links in `page.tsx`, and strip the OAuth buttons from `signup/page.tsx`. No new dependencies required.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 App Router | 15.x | Page routing, SSR/static | Already in use |
| Framer Motion | latest | Page animations | Already used on landing + signup pages |
| Tailwind CSS | 3.x | Styling | Project standard |
| Zod | 3.x | Contact form API validation | Project standard for all route inputs |
| Resend (via emailService) | — | Contact form email delivery | Already wired in `src/lib/services/emailService.ts` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | latest | Icons on pricing/about pages | Already in use project-wide |
| `react-hook-form` | — | Contact form state | Optional — can use useState pattern already used in signup/login |

**Do not add:** `react-hook-form` is optional since the signup page's `useState` pattern works fine for a simple contact form.

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Page Route Structure

```
src/app/
├── privacy/
│   └── page.tsx          # Privacy Policy (static, no auth)
├── terms/
│   └── page.tsx          # Terms of Service (static, no auth)
├── pricing/
│   └── page.tsx          # Pricing page (static, no auth)
├── about/
│   └── page.tsx          # About + Contact form
└── api/
    └── public/
        └── contact/
            └── route.ts  # POST /api/public/contact (no auth, rate-limited)
```

All new pages sit at the apex domain (`lionheartapp.com/privacy`, etc.), the same level as the existing landing page.

### Pattern 1: Static Public Page (Privacy / Terms)

**What:** Server Component by default in App Router. No interactivity needed. Can export `generateMetadata` for SEO.

**When to use:** Privacy Policy, Terms of Service — pure content pages.

```typescript
// Source: Next.js 15 App Router docs
// src/app/privacy/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | Lionheart',
  description: 'How Lionheart collects, uses, and protects your data — including COPPA and FERPA compliance for K-12 schools.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Shared public nav */}
      <PublicNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-gray">
        {/* Content sections */}
      </main>
      <PublicFooter />
    </div>
  )
}
```

### Pattern 2: Shared Public Layout Components

**What:** Extract nav + footer from `page.tsx` into reusable components so Privacy, Terms, Pricing, About all share the same header/footer without duplication.

**Options:**
- Option A: Extract to `src/components/public/PublicNav.tsx` and `PublicFooter.tsx` — import in each page
- Option B: Create `src/app/(public)/layout.tsx` — route group layout wrapping all public pages

**Recommendation:** Option A (shared components). A route group layout would wrap the landing page too, requiring refactoring it. Simpler to extract `PublicNav` and `PublicFooter` as components and import them in each page. The landing page already has the nav/footer inline — leave it alone, just extract the pieces.

```typescript
// src/components/public/PublicNav.tsx
'use client'
import Link from 'next/link'
// Extracted from page.tsx nav — same markup
```

### Pattern 3: Contact Form (Client Component + API Route)

**What:** Simple `useState` form (matching signup page pattern) posts to `/api/public/contact`. Route uses Zod validation and sends email via existing `emailService`.

**When to use:** About page contact section.

```typescript
// Source: matches existing signup/login form patterns in this codebase
// src/app/about/page.tsx (client component section)
'use client'
const [name, setName] = useState('')
const [email, setEmail] = useState('')
const [message, setMessage] = useState('')
const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setStatus('loading')
  const res = await fetch('/api/public/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, message }),
  })
  const data = await res.json()
  setStatus(data.ok ? 'success' : 'error')
}
```

```typescript
// src/app/api/public/contact/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
// Use sendViaResend or a new sendContactEmail helper

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(10).max(2000),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input'), { status: 400 })
    }
    // Send to CONTACT_EMAIL env var or fallback to MAIL_FROM
    // Use existing Resend/SMTP infra from emailService.ts
    return NextResponse.json(ok({ sent: true }))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
```

### Pattern 4: Pricing Page Three-Tier Structure

**What:** Three plan cards (Starter / Professional / Enterprise) with feature comparison table, monthly/annual toggle, recommended tier highlighted.

**Key pricing decisions needed by planner:**
- Tier names and prices are discretionary — use placeholder values that look real
- The "recommended" tier should be the middle plan (Professional) per pricing-strategy skill
- Annual toggle: 20% discount is standard SaaS convention
- Value metric for K-12 SaaS: per school (flat fee) or per user — flat-fee per school is simpler at this stage

```typescript
// Pricing page component pattern (client component for toggle)
'use client'
const [annual, setAnnual] = useState(false)

const plans = [
  { name: 'Starter', price: annual ? 79 : 99, description: 'For small schools', ... },
  { name: 'Professional', price: annual ? 159 : 199, recommended: true, ... },
  { name: 'Enterprise', price: null, cta: 'Contact Sales', ... },
]
```

### Pattern 5: OAuth Button Removal (PAGE-06)

**What:** The Google and Microsoft buttons in `src/app/signup/page.tsx` currently call `setError('Google sign-up coming soon')` and `setError('Microsoft sign-up coming soon')`. They must be removed or hidden.

**Options:**
- Option A: Remove the buttons and the divider entirely — simplest, no dead UI
- Option B: Keep buttons but disable them with a tooltip ("Coming in a future update")

**Recommendation:** Remove entirely. The form is complete without them. A disabled "coming soon" button is worse UX than no button. Remove: the `GoogleIcon` component, `MicrosoftIcon` component, `handleGoogleSignup`, `handleMicrosoftSignup`, the two button elements, and the "or" divider. The `Terms of Service` and `Privacy Policy` text links at the bottom of signup should be wired to `/terms` and `/privacy` while we're editing the file.

### Anti-Patterns to Avoid

- **Shared layout for public pages:** Don't create a route group layout (`(public)/layout.tsx`) to share nav/footer — it forces a double-render for the existing landing page and adds complexity.
- **New email package for contact form:** Don't add a new email library (Nodemailer direct, SendGrid, etc.) when `emailService.ts` already has Resend + SMTP fallback.
- **API route auth for contact form:** The contact endpoint is public — don't add `getUserContext` or `assertCan`. It should be added to `isPublicPath` in middleware.
- **Storing contact submissions in the DB:** No `ContactSubmission` model needed — just deliver by email. State.md notes "no additional table needed" as a decision pattern. Keep it simple.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contact email delivery | Custom fetch to Resend | `sendViaResend` / `sendBrandedEmail` from `emailService.ts` | Already handles Resend + SMTP fallback, error logging |
| Form validation in API | Manual field checks | Zod (project standard) | Consistent with all other routes; proper error messages |
| Legal content structure | Write from scratch | Use established COPPA/FERPA SaaS policy structure (documented below) | Regulatory obligations are well-known; structure is standard |
| Pricing psychology | Custom approach | `pricing-strategy` skill + established three-tier model | Proven patterns for SaaS pricing conversion |
| Page animations | Custom CSS | Framer Motion (already in project) | Consistent with landing/signup page animation style |

**Key insight:** This phase is almost entirely content + wiring. The heavy infrastructure work (routing, email, validation) is already done. The value is in the content quality and UI polish.

---

## Common Pitfalls

### Pitfall 1: Footer Links Left as `href="#"`

**What goes wrong:** Footer links in `src/app/page.tsx` currently use `href="#"` for Features, Pricing, About, Contact, Privacy, and Terms. If the pages are built but footer is not updated, PAGE-05 fails.

**Why it happens:** Easy to forget to update the footer after building pages.

**How to avoid:** Make footer wiring a task step in the plan for 09-03, not an afterthought.

**Warning signs:** Running the smoke test suite and clicking footer links returning 200 for `/#` instead of the actual pages.

### Pitfall 2: New Pages Not Added to `PUBLIC_PATHS` in Middleware

**What goes wrong:** `src/middleware.ts` has `PUBLIC_PATHS = new Set([...])` and the new page routes (`/privacy`, `/terms`, `/pricing`, `/about`) are not in it. Without this, the middleware might attempt auth verification on a path that shouldn't require it.

**Why it happens:** Looking at middleware logic, non-`/api` paths that don't match specific patterns fall through to `NextResponse.next()` on line ~212 (`if (!pathname.startsWith('/api') && !pathname.startsWith('/app'))`). So page routes automatically pass through. However the contact API route `/api/public/contact` IS covered by the existing `/api/public/` public path rule already in middleware (`if (pathname.startsWith('/api/public/')) return true`). No middleware changes needed for new page routes.

**How to avoid:** Confirm: page routes fall through middleware correctly. API route uses the existing `/api/public/` prefix which is already marked public.

**Warning signs:** Getting 401 on `/api/public/contact` when testing without auth cookies.

### Pitfall 3: Contact Form Sending to the Wrong Recipient

**What goes wrong:** The contact form sends to whoever the team wants to receive inquiries. If `CONTACT_EMAIL` env var is not set, there's no fallback recipient.

**Why it happens:** Not defining the recipient clearly in the contact route.

**How to avoid:** Use `CONTACT_EMAIL` env var with a hardcoded fallback (e.g., `no-reply@lionheartapp.com` or a specific team inbox). Document in `.env.example`.

**Warning signs:** Contact form shows success but no email is received.

### Pitfall 4: Signup Page Zod Validation Not Enforcing Password Complexity

**What goes wrong:** While cleaning up OAuth buttons from the signup page, accidentally remove or break the password validation. The current signup page only checks `password.length < 8` on the client — but Phase 8 added server-side complexity rules. The client-side should match (the `PasswordInput` component from 08-06 addresses this).

**Why it happens:** The signup page still uses a plain `<input type="password">` without the new `PasswordInput` component from Phase 8.

**How to avoid:** When editing `signup/page.tsx` for PAGE-06, also swap in the `PasswordInput` component from Phase 8 (same as was done for reset-password and set-password). This was a Phase 8 gap (AUTH-10) already partially addressed.

**Warning signs:** Signup accepts weak passwords that violate the server-side complexity rules.

### Pitfall 5: Legal Content Missing COPPA/FERPA Specifics

**What goes wrong:** PAGE-01 requires the Privacy Policy to "explicitly address COPPA and FERPA data handling for K-12 schools." Generic SaaS privacy policy templates don't mention these.

**Why it happens:** Using a generic template without K-12-specific additions.

**How to avoid:** Include dedicated sections explicitly titled "COPPA Compliance" and "FERPA Compliance" in the Privacy Policy. Content structure documented below.

**Warning signs:** Privacy Policy page passes visual review but reviewer notes absence of COPPA/FERPA section headings.

---

## Code Examples

### Adding `/api/public/contact` to Public Paths (Confirmation — Already Covered)

```typescript
// Source: src/middleware.ts line 70 (existing)
if (pathname.startsWith('/api/public/')) return true
// /api/public/contact will match this — NO middleware change needed
```

### Zod Schema for Contact Form

```typescript
// Source: project Zod convention (matches auth routes)
const ContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  subject: z.string().max(200).optional(),
})
```

### Footer Link Update Pattern

```typescript
// Before (in src/app/page.tsx):
<li><a href="#">Pricing</a></li>
<li><a href="#">About</a></li>
<li><a href="#">Privacy</a></li>

// After:
<li><Link href="/pricing" className="hover:text-white...">Pricing</Link></li>
<li><Link href="/about" className="hover:text-white...">About</Link></li>
<li><Link href="/privacy" className="hover:text-white...">Privacy</Link></li>
```

Note: `<a>` tags in footer should become `<Link>` from `next/link` for client-side navigation.

### Terms/Privacy Links on Signup Page

```typescript
// Update the fine print on signup page (already has text but no links):
// Before:
<p className="text-xs text-gray-500 text-center mt-6">
  By signing up, you agree to our Terms of Service and Privacy Policy
</p>

// After:
<p className="text-xs text-gray-500 text-center mt-6">
  By signing up, you agree to our{' '}
  <Link href="/terms" className="underline hover:text-gray-700">Terms of Service</Link>
  {' '}and{' '}
  <Link href="/privacy" className="underline hover:text-gray-700">Privacy Policy</Link>
</p>
```

---

## Legal Content Structure

### Privacy Policy — Required Sections for COPPA/FERPA Compliance

**Confidence:** MEDIUM — Based on standard SaaS K-12 policy structures. Acceptable for launch; recommend legal review before production scale.

COPPA (Children's Online Privacy Protection Act) applies when a platform may have data from children under 13. Schools using Lionheart may input student data. FERPA (Family Educational Rights and Privacy Act) applies to educational agencies and institutions — Lionheart is a "school official" under FERPA when it has access to student education records.

Required sections in Privacy Policy:

1. **What We Collect** — Organization data (name, email, contact info), user data (name, email, role), operational data (tickets, events, schedules), technical data (cookies, logs)
2. **How We Use Data** — Service delivery, internal operations, communications, security
3. **Data Sharing** — Third-party processors (Supabase/database, Resend/email, Gemini/AI), no sale of data
4. **FERPA Compliance** ← Required for PAGE-01
   - Lionheart acts as a "school official" with a legitimate educational interest
   - We access education records only as directed by the school (operator)
   - Schools retain FERPA-compliant ownership of student data
   - We do not disclose education records to third parties without school consent
5. **COPPA Compliance** ← Required for PAGE-01
   - Lionheart is a school administration platform — we do not knowingly collect personal information from children under 13 directly
   - Any student data entered by school staff is controlled by the school under FERPA
   - Schools are responsible for obtaining necessary parental consent
6. **Data Retention** — Active account data retained for account lifetime; data deletion policy on cancellation
7. **Security** — Encryption at rest and in transit, httpOnly cookies, access controls
8. **User Rights** — Access, correction, deletion requests; contact method
9. **Contact** — Privacy contact email

### Terms of Service — Required Sections

1. **Acceptance of Terms** — Using the platform constitutes acceptance
2. **Description of Service** — School operations management SaaS, multi-tenant
3. **Account Registration** — Organization admin creates account; responsible for all users
4. **Acceptable Use** — No illegal activity, no unauthorized access, no harmful content
5. **Data Ownership** — Customer owns their data; Lionheart is processor
6. **Payment Terms** — Subscription billing (if applicable); free trial terms
7. **Service Availability** — Best-effort uptime; maintenance windows
8. **Limitation of Liability** — Standard SaaS cap at fees paid in prior 12 months
9. **Termination** — Either party may terminate; data export on request before deletion
10. **Governing Law** — State/jurisdiction
11. **Changes to Terms** — 30-day notice for material changes

---

## Pricing Page Content

### Recommended Three-Tier Structure for K-12 SaaS

Based on pricing-strategy skill and project context (school operations platform):

| Tier | Target | Price Point | Value Metric |
|------|--------|-------------|--------------|
| Starter | Small K-12 schools, 1 campus, up to 50 staff | ~$99/mo | Per school flat |
| Professional | Medium schools, multiple campuses, full feature set | ~$199/mo | Per school flat |
| Enterprise | Large districts, custom needs, dedicated support | Contact sales | Custom |

**Feature gates to differentiate:**
- Starter: Core tickets + maintenance, 1 campus, 50 users, email support
- Professional: All modules (Athletics, IT, Calendar), unlimited campuses, unlimited users, priority support, AI features
- Enterprise: Custom integrations, dedicated onboarding, SLA, SSO (when available)

**Pricing page must-haves per pricing-strategy skill:**
- Monthly/annual toggle (annual = ~20% savings)
- "Most Popular" badge on Professional tier
- Feature comparison table
- Short FAQ section (3-5 questions) addressing objections
- Trust signals near CTA (no credit card required, cancel anytime)

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Legal pages as PDFs or external links | Native Next.js pages with proper metadata and SEO | Better indexed, consistent UI |
| Manual email forms (Formspree, Netlify Forms) | Project-owned API route + existing Resend | No third-party dependency; consistent response envelope |
| OAuth buttons disabled with alerts | Remove entirely | Cleaner UX; removes misleading affordance |
| Static HTML legal content | React Server Components with `generateMetadata` | SEO metadata, consistent navigation, accessible |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No Vitest yet (added in Phase 13 — INFRA-01) |
| Config file | None — Phase 13 creates it |
| Quick run command | `npm run smoke:all` (smoke tests against live API) |
| Full suite command | `npm run smoke:all` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PAGE-01 | Privacy page loads with COPPA/FERPA sections | Manual review | `curl -s http://localhost:3004/privacy` | Check for "COPPA" and "FERPA" in response HTML |
| PAGE-02 | Terms page loads with content | Smoke/manual | `curl -s http://localhost:3004/terms` | Confirm non-empty content |
| PAGE-03 | Pricing page loads, shows 3 tiers | Smoke/manual | `curl -s http://localhost:3004/pricing` | Confirm no 404 |
| PAGE-04 | About page loads; contact form POST succeeds | Smoke: `curl -X POST /api/public/contact` | `curl -s -X POST http://localhost:3004/api/public/contact -H "Content-Type: application/json" -d '{"name":"Test","email":"t@t.com","message":"Test message here"}' ` | Should return `{"ok":true}` |
| PAGE-05 | All footer links resolve to real pages | Manual link audit | Click each footer link; verify 200 response | Run after all pages built |
| PAGE-06 | OAuth buttons absent from signup | Manual visual + DOM check | `curl -s http://localhost:3004/signup` | Verify "Continue with Google/Microsoft" absent from HTML |

### Sampling Rate

- **Per task commit:** `curl` spot checks on affected routes (documented above)
- **Per wave merge:** Visual review of all 4 new pages + footer link audit
- **Phase gate:** All 6 requirement checks green before `/gsd:verify-work`

### Wave 0 Gaps

None — no Vitest infrastructure required for this phase. Smoke/curl checks are sufficient. Vitest is a Phase 13 concern.

---

## Open Questions

1. **Pricing actual numbers**
   - What we know: Three-tier structure is confirmed; $99/$199/Enterprise contact is a reasonable placeholder
   - What's unclear: Whether the user has actual pricing in mind
   - Recommendation: Use placeholder prices that look intentional; planner can note they are illustrative

2. **Contact form recipient email**
   - What we know: Resend is configured; `MAIL_FROM` env var exists
   - What's unclear: Where contact form submissions should go (team inbox vs. `MAIL_FROM`)
   - Recommendation: Add `CONTACT_EMAIL` env var; fall back to `MAIL_FROM` if not set; document in CLAUDE.md or `.env.example`

3. **Features footer link**
   - What we know: Footer has "Features" link in Product column
   - What's unclear: Is there a separate `/features` page needed, or should it anchor to the landing page features section?
   - Recommendation: Make it anchor to `/#features` (add an `id="features"` to the features section in `page.tsx`) — no new page needed. This satisfies PAGE-05 without building a full Features page.

4. **"Company information" on About page**
   - What we know: PAGE-04 requires "company information"
   - What's unclear: How much detail is expected — founding story, team members, mission statement?
   - Recommendation: Standard About page with mission statement, what the platform does, and why it was built for schools. No team member photos needed for launch. Include a placeholder mailing address for legal completeness.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/app/page.tsx` (footer, landing nav), `src/app/signup/page.tsx` (OAuth buttons), `src/middleware.ts` (public paths), `src/lib/services/emailService.ts` (email infra)
- Next.js 15 App Router: Server Components default, `generateMetadata` export, route groups
- Project CLAUDE.md: UI conventions, Zod validation pattern, API response envelope, rate limiting

### Secondary (MEDIUM confidence)
- COPPA/FERPA SaaS policy structure: FTC COPPA guidance (ftc.gov), US Dept. of Education FERPA guidance — both have "school official" provisions applicable to SaaS vendors
- Pricing page patterns: project `pricing-strategy` skill + `page-cro` skill
- Three-tier SaaS pricing: validated against multiple K-12 SaaS products (pricing-strategy skill framework)

### Tertiary (LOW confidence)
- Placeholder price points ($99/$199) are illustrative estimates; not validated against actual willingness-to-pay research

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing tools, no new dependencies
- Architecture: HIGH — follows established patterns from landing + signup pages
- Legal content structure: MEDIUM — based on known regulatory obligations; not legal advice
- Pitfalls: HIGH — directly observed from codebase inspection
- Pricing amounts: LOW — illustrative placeholders

**Research date:** 2026-03-09
**Valid until:** 2026-06-09 (stable domain — Next.js App Router patterns, legal frameworks)

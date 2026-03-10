---
phase: 09-marketing-and-legal-pages
plan: "03"
subsystem: ui
tags: [react, framer-motion, zod, email, next-js, public-pages]

# Dependency graph
requires:
  - phase: 09-marketing-and-legal-pages/09-01
    provides: PublicNav and PublicFooter shared components
  - phase: 09-marketing-and-legal-pages/09-02
    provides: /privacy and /terms pages (footer link targets)
provides:
  - About page at /about with company info and mission sections
  - Contact form section at /about#contact with success/error states
  - POST /api/public/contact endpoint (public, no auth)
  - sendContactFormEmail exported from emailService.ts
  - Landing page footer with all 6 links wired to real pages
  - Signup page cleaned of OAuth buttons, with PasswordInput and legal links
affects:
  - future-marketing-phases
  - onboarding-flow

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Public API route pattern under /api/public/ (no auth middleware, Zod validation)
    - Contact form state machine: idle | loading | success | error
    - PasswordInput component used on signup for strength rule indicators

key-files:
  created:
    - src/app/about/page.tsx
    - src/app/about/layout.tsx
    - src/app/api/public/contact/route.ts
  modified:
    - src/lib/services/emailService.ts
    - src/app/page.tsx
    - src/app/signup/page.tsx

key-decisions:
  - "Added sendContactFormEmail export to emailService.ts (uses sendViaResend+SMTP fallback) rather than duplicating Resend fetch inline in the contact API route"
  - "About page uses use client directive (needed for contact form state machine); layout.tsx handles server-side SEO metadata"
  - "Landing page logo link kept as href='#' (home page anchor to top) — only footer nav links updated to real paths"

patterns-established:
  - "Contact form: POST /api/public/contact with Zod schema, sendContactFormEmail, ok({sent:true}) response"
  - "Public page structure: PublicNav + content sections + PublicFooter with id='contact' anchor for deep linking"

requirements-completed: [PAGE-04, PAGE-05, PAGE-06]

# Metrics
duration: 4min
completed: "2026-03-10"
---

# Phase 09 Plan 03: About + Contact + Footer + Signup Cleanup Summary

**About page at /about with contact form, POST /api/public/contact endpoint, wired footer links on landing page, and signup page stripped of OAuth buttons with PasswordInput and legal links**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T00:06:45Z
- **Completed:** 2026-03-10T00:10:21Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- About page with company mission, What Lionheart Does feature grid, and working contact form with success/error states
- POST /api/public/contact API route (public, Zod-validated, email delivery via sendContactFormEmail)
- Landing page footer: all 6 links now navigate to real pages (/pricing, /about, /about#contact, /privacy, /terms, /#features); zero placeholder href="#" remaining in footer
- Signup page: OAuth buttons and divider removed, password field upgraded to PasswordInput with strength rules, legal text links to /terms and /privacy

## Task Commits

Each task was committed atomically:

1. **Task 1: Create About page with Contact form and API route** - `2d776a8` (feat)
2. **Task 2: Wire footer links and clean up signup page** - `8d8ae51` (feat)

## Files Created/Modified

- `src/app/about/page.tsx` - About page (client component): company info sections, contact form with state machine
- `src/app/about/layout.tsx` - Server component with SEO metadata for /about
- `src/app/api/public/contact/route.ts` - Public POST endpoint: Zod validation, sendContactFormEmail, ok/fail envelope
- `src/lib/services/emailService.ts` - Added sendContactFormEmail export (name/email/subject/message → Resend+SMTP)
- `src/app/page.tsx` - Footer links updated to real paths; Features section got id="features"
- `src/app/signup/page.tsx` - Removed OAuth buttons/divider, added PasswordInput, wired legal links

## Decisions Made

- Added `sendContactFormEmail` as a new exported function in emailService.ts rather than making `sendViaResend` public. This is less invasive and keeps the private function private while exposing a domain-specific API.
- About page is `'use client'` because the contact form needs useState for the state machine; SEO metadata lives in a separate `layout.tsx` (server component).
- The landing page logo link (`href="#"`) was intentionally left as-is since it's on the home page itself — linking to the top of the current page is correct behavior.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Email delivery uses the existing RESEND_API_KEY / SMTP config already in .env. Set CONTACT_EMAIL to route contact form submissions to a specific address (falls back to MAIL_FROM if not set).

## Next Phase Readiness

- All public marketing pages are now live: /, /pricing, /about, /about#contact, /privacy, /terms
- All footer links across landing page and shared PublicFooter resolve to real pages
- Signup page is clean and ready for onboarding flow improvements
- Phase 09 complete — ready for Phase 10

---
*Phase: 09-marketing-and-legal-pages*
*Completed: 2026-03-10*

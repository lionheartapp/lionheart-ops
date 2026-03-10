---
phase: 09-marketing-and-legal-pages
plan: "01"
subsystem: ui
tags: [next.js, react, tailwind, legal, privacy, coppa, ferpa]

# Dependency graph
requires: []
provides:
  - Privacy Policy page at /privacy with COPPA and FERPA compliance sections
  - Terms of Service page at /terms with 12 complete legal sections
  - PublicNav shared component (logo + Sign In + Get Started)
  - PublicFooter shared component (4-column grid, real Link paths)
affects:
  - 09-02 (pricing page — imports PublicNav and PublicFooter)
  - 09-03 (about page — imports PublicNav and PublicFooter)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Component legal pages with generateMetadata for SEO
    - Client component shared nav/footer with next/link for all internal routes
    - Shared public layout components in src/components/public/

key-files:
  created:
    - src/components/public/PublicNav.tsx
    - src/components/public/PublicFooter.tsx
    - src/app/privacy/page.tsx
    - src/app/terms/page.tsx
  modified: []

key-decisions:
  - "PublicNav and PublicFooter created as new components; landing page page.tsx left unchanged to avoid regression risk"
  - "Privacy and Terms pages are Server Components (no 'use client') — no interactivity needed, pure content"
  - "Legal footer links use real paths: /privacy, /terms, /pricing, /about — no placeholder # hrefs"

patterns-established:
  - "Public pages pattern: Server Component + PublicNav + max-w-3xl content + PublicFooter"
  - "Legal content uses prose prose-gray with h1 for title, h2 for sections, substantive paragraph text"

requirements-completed: [PAGE-01, PAGE-02]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 09 Plan 01: Privacy Policy and Terms of Service Summary

**COPPA/FERPA-compliant Privacy Policy and Terms of Service pages with reusable PublicNav and PublicFooter components extracted for all public pages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T23:59:26Z
- **Completed:** 2026-03-10T00:03:07Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- Created `PublicNav` with logo linked to `/`, Sign In and Get Started buttons using `next/link`
- Created `PublicFooter` with 4-column grid and real route paths for all links (no placeholder `#`)
- Created Privacy Policy page at `/privacy` with 9 explicit sections including FERPA Compliance and COPPA Compliance headings, plus `generateMetadata` for SEO
- Created Terms of Service page at `/terms` with 12 complete sections including Acceptance of Terms, Limitation of Liability, and Data Ownership, plus `generateMetadata`
- All verification checks pass: COPPA matches (2), FERPA matches (2), Acceptance of Terms matches (2), both pages return HTTP 200

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract PublicNav and PublicFooter shared components** - `8db7abd` (feat)
2. **Task 2: Create Privacy Policy and Terms of Service pages** - `6f6fb60` (feat)

**Plan metadata:** (final commit — docs)

## Files Created/Modified

- `src/components/public/PublicNav.tsx` - Reusable nav bar with logo Link, Sign In, Get Started buttons
- `src/components/public/PublicFooter.tsx` - Reusable dark footer with 4-column grid and real Link paths
- `src/app/privacy/page.tsx` - Server Component with 9 legal sections, FERPA and COPPA compliance
- `src/app/terms/page.tsx` - Server Component with 12 legal sections including data ownership and liability cap

## Decisions Made

- PublicNav and PublicFooter were created as new standalone components rather than modifying `src/app/page.tsx` to avoid regression risk on the landing page. Plans 02 and 03 will import from `@/components/public/`.
- Privacy and Terms pages are Server Components (no `'use client'`) — pure content with no client-side interactivity needed.
- All footer links use real destination paths instead of placeholder `#` hrefs.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PublicNav` and `PublicFooter` are ready for import by Plans 02 (pricing page) and 03 (about page)
- Legal pages satisfy PAGE-01 and PAGE-02 requirements
- No blockers for remaining plans in phase 09

---
*Phase: 09-marketing-and-legal-pages*
*Completed: 2026-03-09*

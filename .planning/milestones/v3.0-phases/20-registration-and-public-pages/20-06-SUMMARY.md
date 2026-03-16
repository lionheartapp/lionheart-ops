---
phase: 20-registration-and-public-pages
plan: 06
subsystem: ui+api
tags: [share-hub, qr-code, registration-management, medical-data, ferpa, stripe, capacity, waitlist]

# Dependency graph
requires:
  - phase: 20-02
    provides: registrationService (cancelRegistration, promoteFromWaitlist), registrationPaymentService (createBalanceIntent), RegistrationForm schema, EventRegistration schema, RegistrationSensitiveData schema

provides:
  - GET/PUT /api/events/projects/[id]/share: share URL + QR SVG/PNG, openAt/closeAt/maxCapacity/waitlistEnabled save, registeredCount/waitlistedCount, isOpen computed flag
  - GET /api/events/projects/[id]/registrations: paginated list with status/search filter, capacity summary row
  - POST /api/events/projects/[id]/registrations: cancel action with waitlist promotion trigger
  - GET /api/events/projects/[id]/registrations/[regId]/medical: FERPA-gated medical data (events:medical:read)
  - ShareHub component: copyable link, QR SVG display + PNG download, registration window controls, capacity bar, branding preview
  - RegistrationManagement component: registration table with badges, search/filter, medical modal, cancel with confirm, Request Balance Payment for DEPOSIT_PAID
  - RegistrationTab updated: Form Design / Registrations / Share & Publish sub-tabs

affects:
  - 20-07-admin-reporting
  - EventProjectTabs (registration sub-tab now has full functionality)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - QR code generated server-side via qrcode package (SVG for inline display, PNG data URL for download)
    - FERPA gate uses assertCan(EVENTS_MEDICAL_READ) — separate from EVENTS_REGISTRATION_MANAGE
    - staggerContainer() called as function (not used as value) for Framer Motion Variants
    - useToast from @/components/Toast (not sonner) for toast notifications
    - TanStack Query v5 — useEffect for state init from fetched data (no onSuccess on useQuery)
    - Cancel action on registrations route POST — triggers promoteFromWaitlist automatically
    - Balance intent POST to /api/registration/[id]/balance-intent with sendEmail:true

key-files:
  created:
    - src/app/api/events/projects/[id]/share/route.ts
    - src/app/api/events/projects/[id]/registrations/route.ts
    - src/app/api/events/projects/[id]/registrations/[regId]/medical/route.ts
    - src/components/events/project/ShareHub.tsx
    - src/components/events/project/RegistrationManagement.tsx
  modified:
    - src/components/events/project/RegistrationTab.tsx

key-decisions:
  - "staggerContainer is a factory function — must be called as staggerContainer() not used as value"
  - "Registration sub-tabs (Form Design / Registrations / Share & Publish) live within RegistrationTab to keep EventProjectTabs clean"
  - "Medical modal fetches on demand — only when shield icon clicked — avoids loading FERPA data unnecessarily"
  - "Cancel button in RegistrationManagement uses a dropdown per row to avoid cluttering the actions column"

# Metrics
duration: 7min
completed: 2026-03-15
---

# Phase 20 Plan 06: Share Hub, Registration Management, and Medical Data API Summary

**Staff-facing share hub with copyable link and QR code for flyers, registration management table with balance payment requests, and FERPA-gated medical data endpoint — all wired into the EventProject Registration tab as three sub-tabs**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-15T12:42:46Z
- **Completed:** 2026-03-15T12:49:14Z
- **Tasks:** 2
- **Files modified:** 6 (5 created, 1 updated)

## Accomplishments

- Share config API (GET/PUT) returning share URL, QR code SVG, PNG data URL, registration window config, and live capacity counts
- Registration list API (GET) with paginated results, search, status filter, and capacity summary; POST for cancel action that triggers waitlist promotion
- FERPA-gated medical data endpoint requiring `events:medical:read` permission — separate from the general registration management permission
- ShareHub component: copy link with "Copied!" feedback, QR SVG inline display + PNG download, datetime pickers for open/close window, capacity progress bar with waitlist toggle
- RegistrationManagement component: summary stats row, search + status filter, avatars/badges table, medical data shield button (on-demand FERPA modal), cancel with confirm, "Request Balance Payment" button only for DEPOSIT_PAID registrations
- RegistrationTab updated with Form Design / Registrations / Share & Publish sub-tab switcher

## Task Commits

1. **Task 1: Create Share and Registrations API routes** — `98c60fe` (feat)
2. **Task 2: Create ShareHub and RegistrationManagement components** — `7bf8d17` (feat)

## Files Created/Modified

- `src/app/api/events/projects/[id]/share/route.ts` — GET/PUT share config with QR code generation
- `src/app/api/events/projects/[id]/registrations/route.ts` — GET paginated list + POST cancel action
- `src/app/api/events/projects/[id]/registrations/[regId]/medical/route.ts` — GET medical data with FERPA gate
- `src/components/events/project/ShareHub.tsx` — Full share hub UI with link, QR, window, capacity, branding
- `src/components/events/project/RegistrationManagement.tsx` — Registration table with all actions
- `src/components/events/project/RegistrationTab.tsx` — Updated with 3 sub-tabs

## Decisions Made

- staggerContainer is a factory function — must be called as `staggerContainer()` not used as a value (TypeScript would error)
- Registration sub-tabs within RegistrationTab keep EventProjectTabs clean at 9 top-level tabs
- Medical modal fetches on demand only — no FERPA data loaded unless staff clicks the shield icon
- Cancel action uses a dropdown per row to avoid cluttering the actions column

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sonner not installed — used project's custom useToast**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** Plan referenced `toast` from 'sonner' but the project uses `useToast` from `@/components/Toast`
- **Fix:** Replaced `import { toast } from 'sonner'` with `import { useToast } from '@/components/Toast'`, used the hook pattern `const { toast } = useToast()`
- **Files modified:** ShareHub.tsx, RegistrationManagement.tsx

**2. [Rule 1 - Bug] staggerContainer used as value instead of called as function**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `staggerContainer` is exported as a function `staggerContainer(stagger, delayChildren)`, not a `Variants` object. TypeScript error: not assignable to type 'Variants'
- **Fix:** Changed all occurrences to `staggerContainer()` (3 occurrences)
- **Files modified:** ShareHub.tsx, RegistrationManagement.tsx

**3. [Rule 1 - Bug] TanStack Query v5 removed onSuccess from useQuery**
- **Found during:** Task 2 (type check)
- **Issue:** Used `onSuccess` callback in `useQuery` options which was removed in TanStack Query v5
- **Fix:** Removed `onSuccess`, added `useEffect` to initialize local state from fetched data with `initialized` guard to prevent re-initialization on refetch
- **Files modified:** ShareHub.tsx

**4. [Rule 2 - Missing] Cancel POST handler needed for RegistrationManagement**
- **Found during:** Task 2 (component calls POST to registrations route)
- **Issue:** RegistrationManagement component POSTs to the registrations route for cancel action, but the GET-only route from the plan had no POST handler
- **Fix:** Added POST handler with Zod validation for `action: 'cancel'`, calls `cancelRegistration()` which triggers `promoteFromWaitlist` automatically
- **Files modified:** src/app/api/events/projects/[id]/registrations/route.ts

---

**Total deviations:** 4 auto-fixed (Rules 1-2)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Self-Check: PASSED

All files exist and commits are present:
- FOUND: src/app/api/events/projects/[id]/share/route.ts
- FOUND: src/app/api/events/projects/[id]/registrations/route.ts
- FOUND: src/app/api/events/projects/[id]/registrations/[regId]/medical/route.ts
- FOUND: src/components/events/project/ShareHub.tsx
- FOUND: src/components/events/project/RegistrationManagement.tsx
- FOUND: src/components/events/project/RegistrationTab.tsx (modified)
- FOUND commit 98c60fe (Task 1)
- FOUND commit 7bf8d17 (Task 2)
